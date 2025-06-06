import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { getCharHight } from '../../utils/doc-helpers';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import renderInlineText from './inlineText';
import { MdTokenType } from '../../enums/mdTokenType';
import { RenderStore } from '../../store/renderStore';

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
    // We'll calculate a base indent so list items at the same level are aligned
    const baseIndent = indentLevel * RenderStore.options.page.indent;
    // The bullet or number for this item
    const bullet = ordered ? `${start}. ` : '\u2022 ';

    // If we are close to bottom, do a page break
    if (
        RenderStore.Y + getCharHight(doc, RenderStore.options) >=
        RenderStore.options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc, RenderStore.options);
        RenderStore.updateY(RenderStore.options.page.topmargin);
    }

    // 1) Print the bullet at (x + baseIndent, y)
    doc.setFont(RenderStore.options.font.regular.name, RenderStore.options.font.regular.style);
    doc.text(bullet, RenderStore.X + baseIndent, RenderStore.Y, { baseline: 'top' });

    // 2) Move x forward by bullet width
    const bulletWidth = doc.getTextWidth(bullet);
    RenderStore.updateX(bulletWidth, 'add');

    // 3) If we have nested items, render them. They might be inline text or sub-lists
    if (element.items && element.items.length > 0) {
        // If the parent is "list_item", then sub-lists are truly nested => indentLevel + 1
        // If the parent is "list", the sub-items are the same level => indentLevel
        for (const subItem of element.items) {
            // Check for page break before each sub-item
            if (
                RenderStore.Y + getCharHight(doc, RenderStore.options) >=
                RenderStore.options.page.maxContentHeight
            ) {
                HandlePageBreaks(doc, RenderStore.options);
                RenderStore.updateY(RenderStore.options.page.topmargin);
            }

            if (subItem.type === MdTokenType.List) {
                // A sub-list is always an extra level of indent
                parentElementRenderer(
                    subItem,
                    indentLevel + 1,
                    true,
                    start,
                    subItem.ordered ?? false,
                );
            } else if (subItem.type === MdTokenType.ListItem) {
                // Same level if parent is a list,
                // otherwise if the parent is a list_item, it's nested => indent + 1
                const newIndentLevel =
                    element.type === MdTokenType.List
                        ? indentLevel
                        : indentLevel + 1;

                parentElementRenderer(
                    subItem,
                    newIndentLevel,
                    true,
                    start,
                    ordered,
                );
            } else {
                // Inline content (e.g., emphasis, text, strong)
                // Render on the same line (indented after bullet)
                renderInlineText(
                    doc,
                    subItem,
                    baseIndent
                );
            }

            // Move to next line after each sub-item (and reset x to left)
            RenderStore.updateX(RenderStore.options.page.xpading)
            RenderStore.updateY(getCharHight(doc, RenderStore.options), 'add');
        }
    } else if (element.content) {
        // handle text with line breaks page break & multiple lines texts
        const bulletX = RenderStore.X + baseIndent;
        const bulletWidth = doc.getTextWidth(bullet);
        const textMaxWidth =
            RenderStore.options.page.maxContentWidth - baseIndent - bulletWidth;
        // Split the content into lines, accounting for the bullet only on the first line
        const textLines = doc.splitTextToSize(element.content, textMaxWidth);
        // Render first line with bullet
        if (textLines.length > 0) {
            doc.text(textLines[0], bulletX + bulletWidth, RenderStore.Y, {
                baseline: 'top',
                maxWidth: textMaxWidth,
            });
            // Render bullet (already rendered above, but for clarity)
            // doc.text(bullet, bulletX, cursor.y, { baseline: 'top' });
            // Render wrapped lines (if any)
            for (let i = 1; i < textLines.length; i++) {
                RenderStore.updateY(getCharHight(doc, RenderStore.options), 'add');
                doc.text(textLines[i], bulletX + bulletWidth, RenderStore.Y, {
                    baseline: 'top',
                    maxWidth: textMaxWidth,
                });
            }
            // Update cursor position
            RenderStore.updateY(getCharHight(doc, RenderStore.options), 'add');
            RenderStore.updateX(RenderStore.options.page.xmargin + baseIndent);
            // Move the cursor forward by the text width (optional, but keep for compatibility)
            const contentWidth = doc.getTextWidth(element.content);
            RenderStore.updateX(contentWidth, 'add');
        }
    }
};

export default renderListItem;
