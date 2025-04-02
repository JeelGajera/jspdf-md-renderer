import jsPDF from 'jspdf';
import { Cursor, ParsedElement } from '../../types';
import { RenderOption } from '../../types';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';

const renderCodeBlock = (
    doc: jsPDF,
    element: ParsedElement,
    cursor: Cursor,
    indentLevel: number,
    hasRawBullet: boolean,
    options: RenderOption,
): Cursor => {
    const indent = indentLevel * options.page.indent;
    if (
        cursor.y +
            doc.splitTextToSize(
                element.code ?? '',
                options.page.maxContentWidth - indent,
            ).length *
                getCharHight(doc, options) -
            2 * getCharHight(doc, options) >=
        options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc, options);
        cursor.y = options.page.topmargin;
    }

    const totalHeight =
        doc.splitTextToSize(
            element.code ?? '',
            options.page.maxContentWidth - indent,
        ).length * getCharHight(doc, options);
    cursor.y += options.page.lineSpace;
    doc.setFillColor('#EEEEEE');
    doc.setDrawColor('#eee');
    doc.roundedRect(
        cursor.x,
        cursor.y - options.page.lineSpace,
        options.page.maxContentWidth,
        totalHeight,
        2,
        2,
        'FD',
    );
    doc.setFontSize(10);
    doc.text(
        element.lang ?? '',
        cursor.x +
            options.page.maxContentWidth -
            doc.getTextWidth(element.lang ?? '') -
            options.page.lineSpace / 2,
        cursor.y,
    );
    doc.setFontSize(options.page.defaultFontSize);
    doc.text(element.code ?? '', cursor.x + 4, cursor.y);

    cursor.y += totalHeight;
    return cursor;
};

export default renderCodeBlock;
