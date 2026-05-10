import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { getCharHight } from '../../utils/doc-helpers';
import { breakIfOverflow } from '../../utils/handlePageBreak';
import { MdTokenType } from '../../enums/mdTokenType';
import { RenderStore } from '../../store/renderStore';
import { renderInlineContent, renderPlainText } from '../../layout';

/**
 * Render a single list item, including bullets/numbering, inline text, and any nested lists.
 */
const renderListItem = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    store: RenderStore,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        store: RenderStore,
        hasRawBullet?: boolean,
        start?: number,
        ordered?: boolean,
    ) => void,
    start: number,
    ordered: boolean,
) => {
    // 1) Page break check
    breakIfOverflow(doc, store, getCharHight(doc));

    // 2) Configuration
    const options = store.options;
    const listOpts = store.options.list ?? {};
    const indentSize = listOpts.indentSize ?? options.page.indent;
    const baseIndent = indentLevel * indentSize;
    const bullet = ordered ? `${start}. ` : (listOpts.bulletChar ?? '\u2022 ');
    const xLeft = options.page.xpading;

    // Reset X to left margin at start of item to ensure consistent bullet placement
    store.updateX(xLeft, 'set');

    // 3) Render Bullet or Checkbox
    doc.setFont(options.font.regular.name, options.font.regular.style);

    let contentX = xLeft + baseIndent;
    let bulletWidth: number;

    if (element.task) {
        const cbSize = doc.getFontSize() * 0.5;
        const cbX = xLeft + baseIndent;
        const cbY = store.Y + (getCharHight(doc) - cbSize) / 2;

        // Outer box
        doc.setDrawColor('#555555');
        doc.setLineWidth(0.4);
        doc.rect(cbX, cbY, cbSize, cbSize);

        // Checkmark if checked
        if (element.checked) {
            doc.setDrawColor('#2B6CB0');
            doc.setLineWidth(0.5);
            const pad = cbSize * 0.2;
            doc.line(
                cbX + pad,
                cbY + cbSize * 0.55,
                cbX + cbSize * 0.4,
                cbY + cbSize - pad,
            );
            doc.line(
                cbX + cbSize * 0.4,
                cbY + cbSize - pad,
                cbX + cbSize - pad,
                cbY + pad,
            );
            doc.setDrawColor('#000000');
        }

        doc.setLineWidth(0.1);
        bulletWidth = cbSize + 2; // Checkbox + gap
    } else {
        doc.text(bullet, xLeft + baseIndent, store.Y, { baseline: 'top' });
        bulletWidth = doc.getTextWidth(bullet);
    }

    contentX += bulletWidth;
    const textMaxWidth =
        options.page.maxContentWidth - baseIndent - bulletWidth;

    // Apply color for checked tasks
    const originalTextColor = doc.getTextColor();
    if (element.checked) {
        doc.setTextColor(150, 150, 150);
    }

    // 4) Render items or content
    if (element.items && element.items.length > 0) {
        const inlineBuffer: ParsedElement[] = [];

        const flushInlineBuffer = () => {
            if (inlineBuffer.length > 0) {
                renderInlineContent(
                    doc,
                    inlineBuffer,
                    contentX,
                    store.Y,
                    textMaxWidth,
                    store,
                );
                inlineBuffer.length = 0;
                store.updateX(xLeft, 'set');
            }
        };

        for (const subItem of element.items) {
            if (subItem.type === MdTokenType.List) {
                flushInlineBuffer();
                parentElementRenderer(
                    subItem,
                    indentLevel,
                    store,
                    true,
                    start,
                    subItem.ordered ?? false,
                );
            } else if (subItem.type === MdTokenType.ListItem) {
                flushInlineBuffer();
                parentElementRenderer(
                    subItem,
                    indentLevel,
                    store,
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
        renderPlainText(
            doc,
            element.content,
            contentX,
            store.Y,
            textMaxWidth,
            store,
        );
    }

    // Restore text color
    doc.setTextColor(originalTextColor);
};

export default renderListItem;
