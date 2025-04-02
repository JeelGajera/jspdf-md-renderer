import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { Cursor, RenderOption } from '../../types/renderOption';
import { justifyText } from '../../utils/justifyText';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';

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
    if (
        cursor.y +
            doc.splitTextToSize(
                element.content ?? '',
                options.page.maxContentWidth - indent,
            ).length *
                getCharHight(doc, options) -
            2 * getCharHight(doc, options) >=
        options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc, options);
        cursor.y = options.page.topmargin;
    }
    if (!element.items && element.content) {
        const lineHeight =
            doc.getTextWidth(element.content) >
            options.page.maxContentWidth - indent
                ? options.page.defaultLineHeightFactor
                : options.page.defaultLineHeightFactor + 0.4;
        cursor.y =
            justifyText(
                doc,
                bullet + element.content,
                cursor.x + indent,
                cursor.y,
                options.page.maxContentWidth - indent,
                lineHeight,
            ) + getCharHight(doc, options);
    }
    // Recursively render nested items if they exist
    if (element.items && element.items.length > 0) {
        for (const subItem of element.items) {
            cursor = parentElementRenderer(
                subItem,
                indentLevel + 1,
                true,
                start,
                ordered,
            );
            cursor.y += getCharHight(doc, options) * 0.2;
        }
    }
    return cursor;
};

export default renderListItem;
