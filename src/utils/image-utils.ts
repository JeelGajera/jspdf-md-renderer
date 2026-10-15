import { jsPDF } from 'jspdf';
import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types';
import {
    attachRenderWarnings,
    handleSecurityViolation,
    isDataUrl,
    isSvgDataUrl,
    validateResourceUrl,
} from '../security/security-policy';
import {
    RenderSecurityOptions,
    SecurityViolation,
    SecurityViolationError,
} from '../types/security';
import {
    RenderWarning,
    RenderWarnings,
    WarningSink,
} from '../store/renderWarnings';

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
        // Counted directly: `/=*$/` retried from every `=` in a long run.
        let padding = 0;
        while (
            padding < normalized.length &&
            normalized[normalized.length - 1 - padding] === '='
        ) {
            padding++;
        }
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

const SVG_WIDTH = /\swidth=(?:'|")([0-9.]+)[a-zA-Z]*(?:'|")/gi;
const SVG_HEIGHT = /\sheight=(?:'|")([0-9.]+)[a-zA-Z]*(?:'|")/gi;
const SVG_VIEWBOX = /\sviewBox=(?:'|")[^'"]*(?:'|")/gi;

/**
 * Finds `attribute` in the first `<svg …>` opening tag that has it.
 *
 * Returns what `/<svg[^>]*<attribute>/i` matched — the text from `<svg` to the
 * end of the tag's last occurrence of the attribute, then its capture groups —
 * in linear time. That regex was retried from every `<svg` and rescanned the
 * rest of the input each time. Here each tag is scanned once: a `<svg` that
 * falls inside an earlier, unclosed tag can only hold matches that tag had.
 */
const findSvgAttribute = (svg: string, attribute: RegExp): string[] | null => {
    const opening = /<svg/gi;
    let start: RegExpExecArray | null;
    while ((start = opening.exec(svg)) !== null) {
        const close = svg.indexOf('>', start.index);
        const tag = svg.slice(start.index, close === -1 ? svg.length : close);

        let last: RegExpMatchArray | null = null;
        for (const match of tag.matchAll(attribute)) last = match;
        if (last) {
            const end = (last.index ?? 0) + last[0].length;
            return [tag.slice(0, end), ...last.slice(1)];
        }

        if (close === -1) return null;
        opening.lastIndex = close + 1;
    }
    return null;
};

/**
 * Extracts width and height from an SVG data URI if possible.
 */
const extractSvgDimensions = (
    dataUri: string,
    warnings?: WarningSink,
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

        const widthMatch = findSvgAttribute(svgString, SVG_WIDTH);
        const heightMatch = findSvgAttribute(svgString, SVG_HEIGHT);
        const viewBoxMatch = findSvgAttribute(svgString, SVG_VIEWBOX);

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
        warnings?.warn({
            code: 'IMAGE_SIZE_UNKNOWN',
            message:
                `Could not read the intrinsic size of an SVG: ${String(e)}. ` +
                'It will be drawn at a fallback size.',
        });
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
    warnings?: WarningSink,
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
                warnings?.warn({
                    code: 'IMAGE_SIZE_UNKNOWN',
                    message:
                        `Could not read the intrinsic size of an image: ${String(e)}. ` +
                        'It will be drawn at a fallback size.',
                    context: element.src,
                });
            }
        } else {
            const svgDims = extractSvgDimensions(element.data, warnings);
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
 * How many image loads may be in flight at once.
 *
 * Remote images used to load strictly one after another, so a document with
 * 20 remote images paid the sum of 20 round trips before anything was drawn.
 * They now load concurrently, but unbounded concurrency would let a single
 * document open hundreds of sockets at once; a handful at a time keeps the
 * wall-clock win without the stampede.
 */
const MAX_CONCURRENT_IMAGE_LOADS = 6;

/**
 * One thing a single image load wants reported, in the order it happened.
 * Reports are collected per image while loads run concurrently, then replayed
 * in document order, so warnings and violations stay deterministic.
 */
type DeferredImageReport =
    | {
          kind: 'violation';
          violation: Omit<SecurityViolation, 'timestamp'>;
      }
    | {
          kind: 'warning';
          warning: RenderWarning;
          /**
           * `console.warn` fallback for the historical no-sink path, used only
           * when the render has no warning collector. Absent for warnings
           * that were silent without a collector.
           */
          consoleMessage?: string;
          consoleError?: unknown;
      };

/**
 * Collects every image element that has a `src`, in document order:
 * depth-first, an image before the items nested inside it — the same order
 * the old sequential loop processed them in.
 */
const collectImageElements = (
    elements: ParsedElement[],
    out: ParsedElement[],
): void => {
    for (const element of elements) {
        if (element.type === MdTokenType.Image && element.src) {
            out.push(element);
        }
        if (element.items && element.items.length > 0) {
            collectImageElements(element.items, out);
        }
    }
};

/**
 * Runs `task` over `items` with at most `limit` tasks in flight at once,
 * returning results in input order.
 */
const runWithBoundedConcurrency = async <T>(
    items: ParsedElement[],
    limit: number,
    task: (item: ParsedElement) => Promise<T>,
): Promise<T[]> => {
    const results: T[] = new Array(items.length);
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < items.length) {
            const index = next;
            next += 1;
            results[index] = await task(items[index]);
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, () => worker()),
    );
    return results;
};

/**
 * Loads a single image element: security checks, fetch, and data-URL/SVG
 * handling exactly as the old sequential loop did. Nothing is reported
 * inline — violations and warnings are returned as reports so the caller can
 * replay them in document order after every concurrent load has settled.
 *
 * `violationMode: 'throw'` semantics: a violation no longer aborts the other
 * in-flight loads. Every load runs to completion, the reports are replayed in
 * document order, and the FIRST violation in document order is thrown — not
 * the first one whose load happened to fail first.
 */
const loadImageElement = async (
    element: ParsedElement,
    security: RenderSecurityOptions | undefined,
): Promise<DeferredImageReport[]> => {
    const reports: DeferredImageReport[] = [];
    const reportViolation = (
        violation: Omit<SecurityViolation, 'timestamp'>,
    ): void => {
        reports.push({ kind: 'violation', violation });
    };
    const reportWarning = (
        warning: RenderWarning,
        consoleMessage?: string,
        consoleError?: unknown,
    ): void => {
        reports.push({
            kind: 'warning',
            warning,
            consoleMessage,
            consoleError,
        });
    };

    // Per-image security view: every check still runs per image, but
    // violations are recorded instead of reported inline, and the mode is
    // forced to 'skip' so a violation drops just this image instead of
    // throwing out of a worker. The real mode is honoured when the reports
    // are replayed in document order.
    const deferredSecurity: RenderSecurityOptions = {
        ...security,
        violationMode: 'skip',
        onSecurityViolation: (violation) => {
            reportViolation({
                code: violation.code,
                type: violation.type,
                message: violation.message,
                value: violation.value,
                context: violation.context,
            });
        },
    };
    const sink: WarningSink = {
        warn: (warning) => reportWarning(warning),
    };
    if (security) {
        // Keeps `silent`/`onWarning` routing (and document-order replay) for
        // the warnings the security helpers emit themselves.
        attachRenderWarnings(deferredSecurity, sink);
    }

    try {
        if (deferredSecurity.enabled) {
            if (isDataUrl(element.src!)) {
                const isSvg = isSvgDataUrl(element.src!);

                if (isSvg && !deferredSecurity.allowSvgImages) {
                    handleSecurityViolation(deferredSecurity, {
                        code: 'SVG_BLOCKED',
                        type: 'image',
                        message: 'SVG images are blocked',
                        value: element.src,
                        context: 'image-src',
                    });
                    element.data = undefined;
                    element.src = undefined;
                    return reports;
                }
                if (!deferredSecurity.allowDataUrls) {
                    handleSecurityViolation(deferredSecurity, {
                        code: 'DATA_URL_BLOCKED',
                        type: 'image',
                        message: 'Data URLs are blocked for images',
                        value: element.src,
                        context: 'image-src',
                    });
                    element.data = undefined;
                    element.src = undefined;
                    return reports;
                }
            } else {
                if (!deferredSecurity.allowRemoteImages) {
                    handleSecurityViolation(deferredSecurity, {
                        code: 'IMAGE_PROTOCOL_BLOCKED',
                        type: 'image',
                        message: 'Remote images are disabled',
                        value: element.src,
                        context: 'image-src',
                    });
                    element.data = undefined;
                    element.src = undefined;
                    return reports;
                }

                const allowed = await validateResourceUrl(
                    element.src!,
                    'image',
                    deferredSecurity,
                    'image-src',
                );
                if (!allowed) {
                    element.data = undefined;
                    element.src = undefined;
                    return reports;
                }
            }
        }

        // If the src is already a data URI, we treat it as loaded (or just store it as data)
        if (element.src!.startsWith('data:')) {
            element.data = element.src;
            const dataUrlBytes = getDataUrlPayloadByteSize(element.data!);
            if (
                deferredSecurity.enabled &&
                deferredSecurity.maxImageSizeBytes &&
                dataUrlBytes !== null &&
                dataUrlBytes > deferredSecurity.maxImageSizeBytes
            ) {
                handleSecurityViolation(deferredSecurity, {
                    code: 'IMAGE_SIZE_EXCEEDED',
                    type: 'image',
                    message: 'Data URL image exceeds maxImageSizeBytes',
                    value: String(dataUrlBytes),
                    context: 'data-url-size',
                });
                element.data = undefined;
                element.src = undefined;
                return reports;
            }
        } else {
            // Try to fetch the image
            const response = await secureImageFetch(
                element.src!,
                deferredSecurity,
            );
            if (!response.ok) {
                await response.body?.cancel().catch(() => {});
                throw new Error(
                    `Failed to fetch image: ${response.statusText}`,
                );
            }

            let blob: Blob;
            try {
                blob = await readImageBlob(
                    response,
                    deferredSecurity.enabled
                        ? (deferredSecurity.maxImageSizeBytes ?? 0)
                        : 0,
                );
            } catch (error) {
                if (!(error instanceof ImageTooLargeError)) {
                    throw error;
                }
                handleSecurityViolation(deferredSecurity, {
                    code: 'IMAGE_SIZE_EXCEEDED',
                    type: 'image',
                    message:
                        error.source === 'content-length'
                            ? 'Declared image size exceeds maxImageSizeBytes'
                            : 'Fetched image exceeds maxImageSizeBytes',
                    value: String(error.bytes),
                    context: error.source,
                });
                element.data = undefined;
                element.src = undefined;
                return reports;
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
                        const dims = extractSvgDimensions(element.data!, sink);
                        const w = dims ? dims.width : img.width || 300;
                        const h = dims ? dims.height : img.height || 150;

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
            // Unreachable through the deferred security view above; kept so a
            // violation that somehow escapes still aborts the render instead
            // of being downgraded to a warning.
            throw error;
        }
        reportWarning(
            {
                code: 'IMAGE_LOAD_FAILED',
                message: `Failed to load image: ${String(error)}`,
                context: element.src,
            },
            `[jspdf-md-renderer] Warning: Failed to load image at ${element.src}. It will be skipped.`,
            error,
        );
    }

    return reports;
};

/**
 * Recursively traverses parsed elements and loads image data for Image tokens.
 *
 * Image nodes are collected first, in document order, then loaded with
 * bounded concurrency (`MAX_CONCURRENT_IMAGE_LOADS` at a time). Every
 * security check still runs per image — URL validation, redirect
 * re-validation, `imageFetchTimeoutMs`, `maxImageSizeBytes` — and warnings
 * plus violations are replayed in document order, so concurrent failures
 * stay deterministic. With `violationMode: 'throw'`, the violation thrown is
 * the first one in document order, after all loads have settled.
 *
 * @param elements - The parsed elements to process.
 */
export const prefetchImages = async (
    elements: ParsedElement[],
    security?: RenderSecurityOptions,
    warnings?: RenderWarnings,
): Promise<void> => {
    const images: ParsedElement[] = [];
    collectImageElements(elements, images);

    const outcomes = await runWithBoundedConcurrency(
        images,
        MAX_CONCURRENT_IMAGE_LOADS,
        (element) => loadImageElement(element, security),
    );

    for (const reports of outcomes) {
        for (const report of reports) {
            if (report.kind === 'violation' && security) {
                // In 'throw' mode this throws the first violation in document
                // order; otherwise it fires onSecurityViolation in document
                // order.
                handleSecurityViolation(security, report.violation);
            } else if (report.kind === 'warning') {
                if (warnings) {
                    warnings.warn(report.warning);
                } else if (report.consoleMessage !== undefined) {
                    console.warn(
                        report.consoleMessage,
                        ...(report.consoleError === undefined
                            ? []
                            : [report.consoleError]),
                    );
                }
            }
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
 * that never answers. It covers reading the body as well as receiving the
 * headers: a server that answers promptly and then sends its body one byte at
 * a time used to hold the render open indefinitely.
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

        const { response, release } = await fetchWithDeadline(
            currentUrl,
            timeoutMs,
            enforce ? 'manual' : 'follow',
        );

        if (!enforce || !REDIRECT_STATUSES.has(response.status)) {
            return keepDeadlineUntilBodyEnds(response, release);
        }

        // A redirect's own body is never read.
        release?.();
        await response.body?.cancel().catch(() => {});

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

/**
 * Starts a request that is aborted after `timeoutMs`. The deadline keeps
 * running once the headers arrive; `release` stops it.
 */
const fetchWithDeadline = async (
    url: string,
    timeoutMs: number,
    redirect: RequestRedirect,
): Promise<{ response: Response; release: (() => void) | null }> => {
    if (timeoutMs <= 0 || typeof AbortController === 'undefined') {
        return { response: await fetch(url, { redirect }), release: null };
    }

    const timedOut = new Error(
        `[jspdf-md-renderer] Image request timed out after ${timeoutMs}ms: ${url}`,
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(timedOut), timeoutMs);
    // Never keep a Node process alive just to fire a deadline whose request
    // is already over.
    (timer as { unref?: () => void }).unref?.();
    const release = () => clearTimeout(timer);

    try {
        const response = await fetch(url, {
            redirect,
            signal: controller.signal,
        });
        return { response, release };
    } catch (error) {
        release();
        throw controller.signal.aborted ? timedOut : error;
    }
};

/**
 * Releases the deadline once the body has been read to the end. Until then an
 * expired deadline aborts the read with the timeout error.
 */
const keepDeadlineUntilBodyEnds = (
    response: Response,
    release: (() => void) | null,
): Response => {
    if (!release) return response;
    if (!response.body || typeof TransformStream === 'undefined') {
        release();
        return response;
    }

    const init: ResponseInit = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    };
    try {
        // Checked before the body is piped, which would lock it.
        new Response(null, init);
    } catch {
        // The constructor rejects some status lines a server can send. The
        // deadline still governs the original body, so return that instead;
        // the timer is unref'd and only fires, harmlessly, after the request.
        return response;
    }

    const body = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({ flush: release }),
    );
    return new Response(body, init);
};

/** A remote image larger than `security.maxImageSizeBytes`. */
class ImageTooLargeError extends Error {
    constructor(
        /** Bytes declared by Content-Length, or received before stopping. */
        readonly bytes: number,
        /** Whether the size came from the header or from the body itself. */
        readonly source: 'content-length' | 'blob-size',
    ) {
        super(`[jspdf-md-renderer] Image exceeds maxImageSizeBytes (${bytes})`);
        this.name = 'ImageTooLargeError';
    }
}

/**
 * Reads a response body, giving up as soon as it exceeds `maxBytes`.
 *
 * The limit used to be checked only after the whole body had been buffered,
 * so a server could make a render hold any amount of data in memory. A
 * Content-Length over the limit is now rejected before any of the body is
 * read, and an undeclared or understated body is cut off at the limit.
 */
const readImageBlob = async (
    response: Response,
    maxBytes: number,
): Promise<Blob> => {
    if (maxBytes <= 0) return response.blob();

    const declared = Number(response.headers.get('content-length') ?? NaN);
    if (Number.isFinite(declared) && declared > maxBytes) {
        await response.body?.cancel().catch(() => {});
        throw new ImageTooLargeError(declared, 'content-length');
    }

    if (!response.body || typeof TransformStream === 'undefined') {
        const blob = await response.blob();
        if (blob.size > maxBytes) {
            throw new ImageTooLargeError(blob.size, 'blob-size');
        }
        return blob;
    }

    let received = 0;
    const limited = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                received += chunk.byteLength;
                if (received > maxBytes) {
                    // Erroring the stream also cancels the request.
                    controller.error(
                        new ImageTooLargeError(received, 'blob-size'),
                    );
                    return;
                }
                controller.enqueue(chunk);
            },
        }),
    );
    // Wrapped in a Response so the blob's type is derived from Content-Type
    // exactly as `response.blob()` derives it.
    return new Response(limited, { headers: response.headers }).blob();
};
