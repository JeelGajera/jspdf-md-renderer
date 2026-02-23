import { jsPDF } from 'jspdf';
import { ParsedElement } from '../../types';
import { RenderStore } from '../../store/renderStore';
import { HandlePageBreaks } from '../../utils/handlePageBreak';

/**
 * Standard DPI for web/screen pixels.
 */
const DEFAULT_DPI = 96;

/**
 * Detects the image format from element data and source.
 */
const detectImageFormat = (element: ParsedElement): string => {
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
    return element.src?.split('.').pop()?.toUpperCase() || 'JPEG';
};

/**
 * Converts pixel values to the document's unit system.
 * Uses 96 DPI as the standard web pixel density.
 *
 * @param px - Value in pixels
 * @param unit - The document unit ('mm' | 'pt' | 'in' | 'px')
 * @returns Value in document units
 */
const pxToDocUnit = (px: number, unit: string = 'mm'): number => {
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
 * Renders an image element into the jsPDF document with smart sizing and alignment.
 *
 * Sizing logic (in order of priority):
 * 1. If both width & height are specified by user → convert from px, use as-is
 * 2. If only width is specified → convert from px, calculate height from aspect ratio
 * 3. If only height is specified → convert from px, calculate width from aspect ratio
 * 4. If nothing specified → use intrinsic dimensions (converted from px to doc units)
 * 5. Always clamp to page bounds (scale down proportionally if needed)
 *
 * Alignment: 'left' (default) | 'center' | 'right'
 * Can be set per-image via markdown attributes or globally via RenderOption.image.defaultAlign
 */
const renderImage = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
) => {
    if (!element.data) {
        return;
    }

    const options = RenderStore.options;
    const docUnit = options.page.unit || 'mm';
    const indent = indentLevel * options.page.indent;
    const maxWidth = options.page.maxContentWidth - indent;
    const pageLeftX = RenderStore.X + indent;
    let currentY = RenderStore.Y;

    try {
        // Get intrinsic image dimensions (always in pixels)
        const props = doc.getImageProperties(element.data);
        const intrinsicPxW = props.width;
        const intrinsicPxH = props.height;
        const aspectRatio = intrinsicPxH > 0 ? intrinsicPxW / intrinsicPxH : 1;

        // --- Determine final dimensions (in document units) ---
        let finalWidth: number;
        let finalHeight: number;

        if (element.width && element.height) {
            // Both specified (in px): convert to doc units
            finalWidth = pxToDocUnit(element.width, docUnit);
            finalHeight = pxToDocUnit(element.height, docUnit);
        } else if (element.width) {
            // Width only (in px): convert and calculate height from aspect ratio
            finalWidth = pxToDocUnit(element.width, docUnit);
            finalHeight = finalWidth / aspectRatio;
        } else if (element.height) {
            // Height only (in px): convert and calculate width from aspect ratio
            finalHeight = pxToDocUnit(element.height, docUnit);
            finalWidth = finalHeight * aspectRatio;
        } else {
            // No dimensions specified: convert intrinsic px to doc units
            finalWidth = pxToDocUnit(intrinsicPxW, docUnit);
            finalHeight = pxToDocUnit(intrinsicPxH, docUnit);
        }

        // --- Clamp to page bounds ---
        // If image exceeds available width, scale down proportionally
        if (finalWidth > maxWidth) {
            const scale = maxWidth / finalWidth;
            finalWidth = maxWidth;
            finalHeight = finalHeight * scale;
        }

        // If image exceeds available content height, scale down proportionally
        const maxH = options.page.maxContentHeight - options.page.topmargin;
        if (finalHeight > maxH) {
            const scale = maxH / finalHeight;
            finalHeight = maxH;
            finalWidth = finalWidth * scale;
        }

        // --- Page break check ---
        if (currentY + finalHeight > options.page.maxContentHeight) {
            HandlePageBreaks(doc);
            currentY = RenderStore.Y;
        }

        // --- Alignment ---
        const align = element.align || options.image?.defaultAlign || 'left';

        let drawX: number;
        switch (align) {
            case 'right':
                drawX = pageLeftX + maxWidth - finalWidth;
                break;
            case 'center':
                drawX = pageLeftX + (maxWidth - finalWidth) / 2;
                break;
            case 'left':
            default:
                drawX = pageLeftX;
                break;
        }

        // --- Detect format ---
        const imgFormat = detectImageFormat(element);

        // --- Draw ---
        doc.addImage(
            element.data,
            imgFormat,
            drawX,
            currentY,
            finalWidth,
            finalHeight,
        );

        RenderStore.updateY(finalHeight, 'add');
        RenderStore.recordContentY();
    } catch (e) {
        console.warn('Failed to render image', e);
    }
};

export default renderImage;
