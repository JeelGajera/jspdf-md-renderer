import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { Cursor, RenderOption } from '../../types/renderOption';
import { getCharHight } from '../../utils/doc-helpers';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import renderInlineText from './inlineText';

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
    const indent = indentLevel * options.page.indent;
    const bullet = ordered ? `${start}. ` : '\u2022 ';

    // Check for page break
    if (
        cursor.y + getCharHight(doc, options) >=
        options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc, options);
        cursor.y = options.page.topmargin;
    }

    // Render bullet
    doc.setFont(options.font.regular.name, options.font.regular.style);
    doc.text(bullet, cursor.x + indent, cursor.y, { baseline: 'top' });
    cursor.x += doc.getTextWidth(bullet);

    // Render inline content
    if (element.items && element.items.length > 0) {
        for (const subItem of element.items) {
            cursor = renderInlineText(
                doc,
                subItem,
                cursor,
                indent,
                options,
            );
        }
    } else if (element.content) {
        doc.text(element.content, cursor.x, cursor.y, { baseline: 'top' });
        cursor.x += doc.getTextWidth(element.content);
    }

    // Move to next line after the entire list item
    cursor.y += getCharHight(doc, options);
    cursor.x = options.page.xpading;

    return cursor;
};

export default renderListItem;