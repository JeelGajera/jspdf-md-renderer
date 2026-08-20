import { jsPDF } from 'jspdf';
import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types';
import {
    handleSecurityViolation,
    isDataUrl,
    isSvgDataUrl,
    validateResourceUrl,
} from '../security/security-policy';
import {
    RenderSecurityOptions,
    SecurityViolationError,
} from '../types/security';

/**
 * Standard DPI for web/screen pixels.
 */
const DEFAULT_DPI = 96;

const getDataUrlPayloadByteSize = (dataUrl: string): number | null => {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0) return null;

    const metadata = dataUrl.slice(0, commaIndex).toLowerCase();
    const payload = dataUrl.slice(commaIndex + 1);

    if (metadata.includes(';base64')) {
        const normalized = payload.replace(/\s/g, '');
        const padding = normalized.match(/=*$/)?.[0].length ?? 0;
        return Math.floor((normalized.length * 3) / 4) - padding;
    }

    try {
        const decoded = decodeURIComponent(payload);
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(decoded).length;
        }
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(decoded, 'utf-8').byteLength;
        }
        return decoded.length;
    } catch {
        return null;
    }
};

/**
 * Converts a fetched image blob into a `data:` URL.
 *
 * `FileReader` is a browser API and is not a Node global — not even in Node 22 —
 * so the previous FileReader-only implementation threw a ReferenceError on
 * every server-side render. The error was swallowed by the caller's catch and
 * downgraded to a warning, so remote images were silently dropped from every
 * PDF generated outside a browser. Prefer the isomorphic `arrayBuffer()` path
 * and keep `FileReader` only as a fallback for exotic runtimes.
 */
export const blobToDataUrl = async (blob: Blob): Promise<string> => {
    const mime = blob.type || 'image/png';

    if (typeof blob.arrayBuffer === 'function') {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        return `data:${mime};base64,${bytesToBase64(bytes)}`;
    }

    if (typeof FileReader !== 'undefined') {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else {
                    reject(
                        new Error('Failed to convert image to base64 string'),
                    );
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    throw new Error(
        '[jspdf-md-renderer] No supported way to read image data in this runtime.',
    );
};

/**
 * Base64-encodes bytes using whichever primitive the runtime provides.
 * Chunked so a large image cannot blow the argument limit of `fromCharCode`.
 */
const bytesToBase64 = (bytes: Uint8Array): string => {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }

    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }

    if (typeof btoa === 'function') return btoa(binary);

    throw new Error(
        '[jspdf-md-renderer] No base64 encoder available in this runtime.',
    );
};

/**
 * Converts pixel values to the document's unit system.
 * Uses 96 DPI as the standard web pixel density.
 *
 * @param px - Value in pixels
 * @param unit - The document unit ('mm' | 'pt' | 'in' | 'px')
 * @returns Value in document units
 */
export const pxToDocUnit = (px: number, unit: string = 'mm'): number => {
    switch (unit) {
        case 'pt':
            return (px * 72) / DEFAULT_DPI;
        case 'in':
            return px / DEFAULT_DPI;
        case 'px':
            return px;
        case 'mm':
        default:
            return (px * 25.4) / DEFAULT_DPI;
    }
};

/**
 * Detects the image format from a ParsedElement's data URI and source URL.
 * Returns a format string suitable for jsPDF's addImage (e.g. 'PNG', 'JPEG').
 */
export const detectImageFormat = (element: ParsedElement): string => {
    if (element.data) {
        if (element.data.startsWith('data:image/png')) return 'PNG';
        if (
            element.data.startsWith('data:image/jpeg') ||
            element.data.startsWith('data:image/jpg')
        )
            return 'JPEG';
        if (element.data.startsWith('data:image/webp')) return 'WEBP';
        if (element.data.startsWith('data:image/gif')) return 'GIF';
    }

    // Fallback: extract extension from src, ignoring query parameters and hashes
    if (element.src) {
        const urlWithoutQuery = element.src.split('?')[0].split('#')[0];
        const ext = urlWithoutQuery.split('.').pop()?.toUpperCase();
        if (ext && ['PNG', 'JPEG', 'JPG', 'WEBP', 'GIF'].includes(ext)) {
            return ext === 'JPG' ? 'JPEG' : ext;
        }
    }

    return 'JPEG'; // Default fallback format for jsPDF
};

/**
 * Extracts width and height from an SVG data URI if possible.
 */
const extractSvgDimensions = (
    dataUri: string,
): { width: number; height: number } | null => {
    try {
        let svgString = '';
        if (dataUri.includes('base64,')) {
            const base64 = dataUri.split('base64,')[1];
            if (
                typeof window !== 'undefined' &&
                typeof window.atob === 'function'
            ) {
                svgString = decodeURIComponent(escape(window.atob(base64)));
            } else if (typeof Buffer !== 'undefined') {
                svgString = Buffer.from(base64, 'base64').toString('utf-8');
            } else {
                svgString = decodeURIComponent(escape(atob(base64)));
            }
        } else {
            svgString = decodeURIComponent(dataUri.split(',')[1] || '');
        }

        const widthMatch = svgString.match(
            /<svg[^>]*\swidth=(?:'|")([0-9.]+)[a-zA-Z]*(?:'|")/i,
        );
        const heightMatch = svgString.match(
            /<svg[^>]*\sheight=(?:'|")([0-9.]+)[a-zA-Z]*(?:'|")/i,
        );
        const viewBoxMatch = svgString.match(
            /<svg[^>]*\sviewBox=(?:'|")[^'"]*(?:'|")/i,
        );

        let w = widthMatch ? parseFloat(widthMatch[1]) : 0;
        let h = heightMatch ? parseFloat(heightMatch[1]) : 0;

        if ((!w || !h) && viewBoxMatch) {
            const viewBoxStr = viewBoxMatch[0].match(
                /viewBox=(?:'|")([^'"]+)(?:'|")/i,
            );
            if (viewBoxStr) {
                const parts = viewBoxStr[1]
                    .split(/[ ,]+/)
                    .filter(Boolean)
                    .map(parseFloat);
                if (parts.length >= 4) {
                    w = w || parts[2];
                    h = h || parts[3];
                }
            }
        }

        if (w > 0 && h > 0) return { width: w, height: h };
    } catch (e) {
        console.warn('Failed to extract SVG dimensions:', e);
    }
    return null;
};

/**
 * Calculates final dimensions for an image, respecting intrinsic size,
 * user-specified attributes, and page bounds.
 */
export const calculateImageDimensions = (
    doc: jsPDF,
    element: ParsedElement,
    maxWidth: number,
    maxHeight: number,
    docUnit: string = 'mm',
): { finalWidth: number; finalHeight: number } => {
    if (!element.data) {
        return { finalWidth: 0, finalHeight: 0 };
    }

    let intrinsicPxW = element.naturalWidth || 0;
    let intrinsicPxH = element.naturalHeight || 0;

    // jsPDF's getImageProperties doesn't support SVG natively and throws an UNKNOWN error.
    if (!intrinsicPxW || !intrinsicPxH) {
        if (!element.data.startsWith('data:image/svg')) {
            try {
                const props = doc.getImageProperties(element.data);
                intrinsicPxW = props.width;
                intrinsicPxH = props.height;
            } catch (e) {
                console.warn(
                    'Failed to get image properties for intrinsic sizing:',
                    e,
                );
            }
        } else {
            const svgDims = extractSvgDimensions(element.data);
            if (svgDims) {
                // Treat the extracted dimensions as standard intrinsic pixels
                intrinsicPxW = svgDims.width;
                intrinsicPxH = svgDims.height;
            }
        }
    }

    const aspectRatio = intrinsicPxH > 0 ? intrinsicPxW / intrinsicPxH : 1;

    let finalWidth: number;
    let finalHeight: number;

    if (element.width && element.height) {
        finalWidth = pxToDocUnit(element.width, docUnit);
        finalHeight = pxToDocUnit(element.height, docUnit);
    } else if (element.width) {
        finalWidth = pxToDocUnit(element.width, docUnit);
        finalHeight = finalWidth / aspectRatio;
    } else if (element.height) {
        finalHeight = pxToDocUnit(element.height, docUnit);
        finalWidth = finalHeight * aspectRatio;
    } else {
        finalWidth = pxToDocUnit(intrinsicPxW, docUnit);
        finalHeight = pxToDocUnit(intrinsicPxH, docUnit);
    }

    if (finalWidth > maxWidth) {
        const scale = maxWidth / finalWidth;
        finalWidth = maxWidth;
        finalHeight = finalHeight * scale;
    }

    if (finalHeight > maxHeight) {
        const scale = maxHeight / finalHeight;
        finalHeight = maxHeight;
        finalWidth = finalWidth * scale;
    }

    return { finalWidth, finalHeight };
};

/**
 * Recursively traverses parsed elements and loads image data for Image tokens.
 * @param elements - The parsed elements to process.
 */
export const prefetchImages = async (
    elements: ParsedElement[],
    security?: RenderSecurityOptions,
): Promise<void> => {
    for (const element of elements) {
        if (element.type === MdTokenType.Image && element.src) {
            try {
                if (security?.enabled) {
                    if (isDataUrl(element.src)) {
                        const isSvg = isSvgDataUrl(element.src);

                        if (isSvg && !security.allowSvgImages) {
                            handleSecurityViolation(security, {
                                code: 'SVG_BLOCKED',
                                type: 'image',
                                message: 'SVG images are blocked',
                                value: element.src,
                                context: 'image-src',
                            });
                            element.data = undefined;
                            element.src = undefined;
                            continue;
                        }
                        if (!security.allowDataUrls) {
                            handleSecurityViolation(security, {
                                code: 'DATA_URL_BLOCKED',
                                type: 'image',
                                message: 'Data URLs are blocked for images',
                                value: element.src,
                                context: 'image-src',
                            });
                            element.data = undefined;
                            element.src = undefined;
                            continue;
                        }
                    } else {
                        if (!security.allowRemoteImages) {
                            handleSecurityViolation(security, {
                                code: 'IMAGE_PROTOCOL_BLOCKED',
                                type: 'image',
                                message: 'Remote images are disabled',
                                value: element.src,
                                context: 'image-src',
                            });
                            element.data = undefined;
                            element.src = undefined;
                            continue;
                        }

                        const allowed = await validateResourceUrl(
                            element.src,
                            'image',
                            security,
                            'image-src',
                        );
                        if (!allowed) {
                            element.data = undefined;
                            element.src = undefined;
                            continue;
                        }
                    }
                }

                // If the src is already a data URI, we treat it as loaded (or just store it as data)
                if (element.src.startsWith('data:')) {
                    element.data = element.src;
                    const dataUrlBytes = getDataUrlPayloadByteSize(
                        element.data,
                    );
                    if (
                        security?.enabled &&
                        security.maxImageSizeBytes &&
                        dataUrlBytes !== null &&
                        dataUrlBytes > security.maxImageSizeBytes
                    ) {
                        handleSecurityViolation(security, {
                            code: 'IMAGE_SIZE_EXCEEDED',
                            type: 'image',
                            message: 'Data URL image exceeds maxImageSizeBytes',
                            value: String(dataUrlBytes),
                            context: 'data-url-size',
                        });
                        element.data = undefined;
                        element.src = undefined;
                        continue;
                    }
                } else {
                    // Try to fetch the image
                    const response = await secureImageFetch(
                        element.src,
                        security,
                    );
                    if (!response.ok) {
                        throw new Error(
                            `Failed to fetch image: ${response.statusText}`,
                        );
                    }
                    const blob = await response.blob();
                    if (
                        security?.enabled &&
                        security.maxImageSizeBytes &&
                        blob.size > security.maxImageSizeBytes
                    ) {
                        handleSecurityViolation(security, {
                            code: 'IMAGE_SIZE_EXCEEDED',
                            type: 'image',
                            message: 'Fetched image exceeds maxImageSizeBytes',
                            value: String(blob.size),
                            context: 'blob-size',
                        });
                        element.data = undefined;
                        element.src = undefined;
                        continue;
                    }

                    element.data = await blobToDataUrl(blob);
                }

                // If in browser, asynchronously rasterize SVG to a transparent PNG for jsPDF's synchronous engine
                if (element.data && element.data.startsWith('data:image/svg')) {
                    if (
                        typeof window !== 'undefined' &&
                        typeof document !== 'undefined'
                    ) {
                        element.data = await new Promise<string>((resolve) => {
                            const img = new Image();
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const dims = extractSvgDimensions(
                                    element.data!,
                                );
                                const w = dims ? dims.width : img.width || 300;
                                const h = dims
                                    ? dims.height
                                    : img.height || 150;

                                // Save natural dimensions before we scale up for PDF render context
                                element.naturalWidth = w;
                                element.naturalHeight = h;

                                const scale = 4; // High-res PDF scaling
                                canvas.width = w * scale;
                                canvas.height = h * scale;

                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                    ctx.scale(scale, scale);
                                    ctx.drawImage(img, 0, 0, w, h);
                                    resolve(canvas.toDataURL('image/png'));
                                } else {
                                    resolve(element.data!);
                                }
                            };
                            img.onerror = () => resolve(element.data!);
                            img.src = element.data!;
                        });
                    }
                }
            } catch (error) {
                if (error instanceof SecurityViolationError) {
                    throw error;
                }
                console.warn(
                    `[jspdf-md-renderer] Warning: Failed to load image at ${element.src}. It will be skipped.`,
                    error,
                );
            }
        }

        if (element.items && element.items.length > 0) {
            await prefetchImages(element.items, security);
        }
    }
};

/** Upper bound on redirect hops we will follow before giving up. */
const MAX_REDIRECT_HOPS = 5;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Remote image fetch hardening.
 *
 * Validating only the URL the markdown supplied is not enough: `fetch` follows
 * redirects transparently, so an allowed host could 302 the request to any
 * internal address and the response body would be embedded in the PDF with no
 * check at all. Every hop is therefore resolved and re-validated here, with
 * redirects taken manually so the chain cannot outrun the policy.
 *
 * A timeout is applied per request, because `security.renderTimeoutMs` is only
 * sampled at checkpoints between render phases and cannot interrupt a socket
 * that never answers.
 */
export const secureImageFetch = async (
    url: string,
    security?: RenderSecurityOptions,
): Promise<Response> => {
    const enforce = security?.enabled === true;
    const timeoutMs = enforce ? (security?.imageFetchTimeoutMs ?? 0) : 0;

    let currentUrl = url;

    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
        if (enforce) {
            // Re-validate immediately before each request. On the first hop
            // this also narrows the DNS-rebind window; on later hops it is the
            // only thing standing between a redirect and an internal service.
            const allowed = await validateResourceUrl(
                currentUrl,
                'image',
                security,
                hop === 0 ? 'pre-fetch-recheck' : 'redirect-recheck',
            );
            if (!allowed) {
                throw new Error(
                    `[jspdf-md-renderer] URL blocked on ${
                        hop === 0 ? 'pre-fetch recheck' : `redirect hop ${hop}`
                    }: ${currentUrl}`,
                );
            }
        }

        const response = await fetchWithTimeout(
            currentUrl,
            timeoutMs,
            enforce ? 'manual' : 'follow',
        );

        if (!enforce || !REDIRECT_STATUSES.has(response.status)) {
            return response;
        }

        const location = response.headers.get('location');
        if (!location) return response;

        // Resolve relative redirect targets against the URL that issued them.
        try {
            currentUrl = new URL(location, currentUrl).toString();
        } catch {
            throw new Error(
                `[jspdf-md-renderer] Image redirect target could not be parsed: ${location}`,
            );
        }
    }

    throw new Error(
        `[jspdf-md-renderer] Image request exceeded ${MAX_REDIRECT_HOPS} redirects: ${url}`,
    );
};

const fetchWithTimeout = async (
    url: string,
    timeoutMs: number,
    redirect: RequestRedirect,
): Promise<Response> => {
    if (timeoutMs <= 0 || typeof AbortController === 'undefined') {
        return fetch(url, { redirect });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { redirect, signal: controller.signal });
    } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
            throw new Error(
                `[jspdf-md-renderer] Image request timed out after ${timeoutMs}ms: ${url}`,
                { cause: error },
            );
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
};
