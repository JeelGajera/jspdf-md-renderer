import { jsPDF } from 'jspdf';
import { ParsedElement } from '../../types';
import { RenderStore } from '../../store/renderStore';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import {
    calculateImageDimensions,
    detectImageFormat,
} from '../../utils/image-utils';

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
    store: RenderStore,
) => {
    if (!element.data) {
        return;
    }

    const options = store.options;
    const docUnit = options.page.unit || 'mm';
    const indent = indentLevel * options.page.indent;
    const maxWidth = options.page.maxContentWidth - indent;
    const pageLeftX = store.X + indent;
    let currentY = store.Y;

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
            HandlePageBreaks(doc, store);
            currentY = store.Y;
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

        store.updateY(finalHeight, 'add');
        store.updateY(store.options.spacing?.afterImage ?? 2, 'add');
        store.recordContentY();
    } catch (e) {
        console.warn('[jspdf-md-renderer] Failed to render image', e);
    }
};

export default renderImage;
