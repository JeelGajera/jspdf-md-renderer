import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { Cursor, RenderOption } from '../../types/renderOption';
import { getCharHight } from '../../utils/doc-helpers';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import renderInlineText from './inlineText';
import { MdTokenType } from '../../enums/mdTokenType';

/**
 * Render a single list item, including bullets/numbering, inline text, and any nested lists.
 */
const renderListItem = (
    doc: jsPDF,
    element: ParsedElement,
    cursor: Cursor,
    indentLevel: number,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
        start?: number,
        ordered?: boolean,
    ) => Cursor,
    start: number,
    ordered: boolean,
): Cursor => {
    // We'll calculate a base indent so list items at the same level are aligned
    const baseIndent = indentLevel * options.page.indent;
    // The bullet or number for this item
    const bullet = ordered ? `${start}. ` : '\u2022 ';

    // If we are close to bottom, do a page break
    if (
        cursor.y + getCharHight(doc, options) >=
        options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc, options);
        cursor.y = options.page.topmargin;
    }

    // 1) Print the bullet at (x + baseIndent, y)
    doc.setFont(options.font.regular.name, options.font.regular.style);
    doc.text(bullet, cursor.x + baseIndent, cursor.y, { baseline: 'top' });

    // 2) Move x forward by bullet width
    const bulletWidth = doc.getTextWidth(bullet);
    cursor.x += bulletWidth;

    // 3) If we have nested items, render them. They might be inline text or sub-lists
    if (element.items && element.items.length > 0) {
        // If the parent is "list_item", then sub-lists are truly nested => indentLevel + 1
        // If the parent is "list", the sub-items are the same level => indentLevel
        for (const subItem of element.items) {
            // Check for page break before each sub-item
            if (
                cursor.y + getCharHight(doc, options) >=
                options.page.maxContentHeight
            ) {
                HandlePageBreaks(doc, options);
                cursor.y = options.page.topmargin;
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
                cursor = renderInlineText(
                    doc,
                    subItem,
                    cursor,
                    baseIndent,
                    options
                );
            }

            // Move to next line after each sub-item (and reset x to left)
            cursor.x = options.page.xpading;
            cursor.y += getCharHight(doc, options);
        }
    } else if (element.content) {
        // handle text with line breaks page break & multiple lines texts
        const textLines = doc.splitTextToSize(
            element.content,
            options.page.maxContentWidth - baseIndent - cursor.x,
        );
        // Render text
        doc.text(
            textLines,
            cursor.x + baseIndent,
            cursor.y,
            {
                baseline: 'top',
                maxWidth: options.page.maxContentWidth - baseIndent - cursor.x,
            },
        );
        // Update cursor position\
        cursor.y += getCharHight(doc, options) * textLines.length;
        cursor.x = options.page.xmargin + baseIndent;
        // Move the cursor forward by the text width
        const contentWidth = doc.getTextWidth(element.content);
        cursor.x += contentWidth;
    }

    return cursor;
};

export default renderListItem;
