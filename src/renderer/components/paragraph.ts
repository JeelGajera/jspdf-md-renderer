import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { getCharWidth } from '../../utils/doc-helpers';
import renderInlineText from './inlineText';
import { RenderStore } from '../../store/renderStore';
import { TextRenderer } from '../../utils/text-renderer';

/**
 * Renders paragraph elements.
 */
const renderParagraph = (
    doc: jsPDF,
    element: ParsedElement,
    indent: number,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => void,
) => {
    RenderStore.activateInlineLock();
    doc.setFontSize(RenderStore.options.page.defaultFontSize);
    const content = element.content;
    const lineHeight =
        doc.getTextDimensions('A').h *
        RenderStore.options.page.defaultLineHeightFactor;
    if (element?.items && element?.items.length > 0) {
        let idx = 0;
        for (const item of element?.items ?? []) {
            if (['strong', 'em', 'text', 'codespan'].includes(item.type)) {
                if (item.type !== 'text' && idx != 0) {
                    RenderStore.updateX(getCharWidth(doc) * 1.5, 'add');
                }
                renderInlineText(doc, item, indent);
                if (item.type !== 'text' && idx != 0) {
                    RenderStore.updateX(getCharWidth(doc), 'add');
                }
            } else {
                parentElementRenderer(item, indent, false);
            }
            idx++;
        }
    } else {
        // Use TextRenderer for robust multi-page handling
        const maxWidth = RenderStore.options.page.maxContentWidth - indent;

        // This handles breaking across pages automatically
        TextRenderer.renderText(
            doc,
            content ?? '',
            RenderStore.X + indent,
            RenderStore.Y,
            maxWidth,
            true, // justify
        );
    }

    // Move to next line after paragraph
    RenderStore.updateY(lineHeight, 'add');
    RenderStore.updateX(RenderStore.options.page.xpading);
    RenderStore.deactivateInlineLock();
};

export default renderParagraph;
