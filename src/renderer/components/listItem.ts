import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { getCharHight } from '../../utils/doc-helpers';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { MdTokenType } from '../../enums/mdTokenType';
import { RenderStore } from '../../store/renderStore';
import { JustifiedTextRenderer } from '../../utils/justifiedTextRenderer';
import { TextRenderer } from '../../utils/text-renderer';

/**
 * Render a single list item, including bullets/numbering, inline text, and any nested lists.
 */
const renderListItem = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
        start?: number,
        ordered?: boolean,
    ) => void,
    start: number,
    ordered: boolean,
) => {
    // 1) Page break check
    if (
        RenderStore.Y + getCharHight(doc) >=
        RenderStore.options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc);
    }

    // 2) Configuration
    const options = RenderStore.options;
    const baseIndent = indentLevel * options.page.indent;
    const bullet = ordered ? `${start}. ` : '\u2022 ';
    const xLeft = options.page.xpading;

    // Reset X to left margin at start of item to ensure consistent bullet placement
    RenderStore.updateX(xLeft, 'set');

    // 3) Render Bullet
    doc.setFont(options.font.regular.name, options.font.regular.style);
    doc.text(bullet, xLeft + baseIndent, RenderStore.Y, { baseline: 'top' });

    const bulletWidth = doc.getTextWidth(bullet);
    const contentX = xLeft + baseIndent + bulletWidth;
    const textMaxWidth =
        options.page.maxContentWidth - baseIndent - bulletWidth;

    // 4) Render items or content
    if (element.items && element.items.length > 0) {
        const inlineBuffer: ParsedElement[] = [];

        const flushInlineBuffer = () => {
            if (inlineBuffer.length > 0) {
                JustifiedTextRenderer.renderStyledParagraph(
                    doc,
                    inlineBuffer,
                    contentX,
                    RenderStore.Y,
                    textMaxWidth,
                );
                inlineBuffer.length = 0;
                // Important: Text rendering updates X to the end of the line.
                // We MUST reset it to the left margin for any subsequent block elements (like sub-lists).
                RenderStore.updateX(xLeft, 'set');
            }
        };

        for (const subItem of element.items) {
            if (subItem.type === MdTokenType.List) {
                flushInlineBuffer();
                parentElementRenderer(
                    subItem,
                    indentLevel + 1,
                    true,
                    start,
                    subItem.ordered ?? false,
                );
            } else if (subItem.type === MdTokenType.ListItem) {
                flushInlineBuffer();
                parentElementRenderer(
                    subItem,
                    indentLevel + 1,
                    true,
                    start,
                    ordered,
                );
            } else {
                inlineBuffer.push(subItem);
            }
        }
        flushInlineBuffer();
    } else if (element.content) {
        const textAlignment = options.content?.textAlignment ?? 'left';
        TextRenderer.renderText(
            doc,
            element.content,
            contentX,
            RenderStore.Y,
            textMaxWidth,
            textAlignment === 'justify',
        );
    }
};

export default renderListItem;
