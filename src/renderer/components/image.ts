import { jsPDF } from 'jspdf';
import { ParsedElement } from '../../types';
import { RenderStore } from '../../store/renderStore';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { calculateImageDimensions } from '../../utils/image-utils';

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
        const maxH = options.page.maxContentHeight - options.page.topmargin;

        const { finalWidth, finalHeight } = calculateImageDimensions(
            doc,
            element,
            maxWidth,
            maxH,
            docUnit,
        );

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
        if (finalWidth > 0 && finalHeight > 0) {
            doc.addImage(
                element.data,
                imgFormat,
                drawX,
                currentY,
                finalWidth,
                finalHeight,
            );
        }

        RenderStore.updateY(finalHeight, 'add');
        RenderStore.recordContentY();
    } catch (e) {
        console.warn('Failed to render image', e);
    }
};

export default renderImage;
