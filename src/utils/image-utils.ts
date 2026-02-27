import { jsPDF } from 'jspdf';
import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types';

/**
 * Standard DPI for web/screen pixels.
 */
const DEFAULT_DPI = 96;

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
): Promise<void> => {
    for (const element of elements) {
        if (element.type === MdTokenType.Image && element.src) {
            try {
                // If the src is already a data URI, we treat it as loaded (or just store it as data)
                if (element.src.startsWith('data:')) {
                    element.data = element.src;
                } else {
                    // Try to fetch the image
                    const response = await fetch(element.src);
                    if (!response.ok) {
                        throw new Error(
                            `Failed to fetch image: ${response.statusText}`,
                        );
                    }
                    const blob = await response.blob();

                    // Convert blob to base64
                    const base64 = await new Promise<string>(
                        (resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                if (typeof reader.result === 'string') {
                                    resolve(reader.result);
                                } else {
                                    reject(
                                        new Error(
                                            'Failed to convert image to base64 string',
                                        ),
                                    );
                                }
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        },
                    );

                    element.data = base64;
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
                console.warn(
                    `[jspdf-md-renderer] Warning: Failed to load image at ${element.src}. It will be skipped.`,
                    error,
                );
            }
        }

        if (element.items && element.items.length > 0) {
            await prefetchImages(element.items);
        }
    }
};
