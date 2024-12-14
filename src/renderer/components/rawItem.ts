import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';

const renderRawItem = (
    doc: jsPDF,
    element: ParsedElement,
    x: number,
    y: number,
    indentLevel: number,
    hasRawBullet: boolean,
    options: RenderOption,
): number => {
    const indent = indentLevel * options.page.indent;
    const bullet = hasRawBullet ? '\u2022 ' : ''; // unicode for bullet point
    const lines = doc.splitTextToSize(bullet + element.content, options.page.maxContentWidth - indent);
    if (
        y +
            lines.length *
                getCharHight(doc, options) >=
        options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc, options);
        y = options.page.topmargin;
    }
    doc.text(lines, x + indent, y);
    y += (lines.length) * getCharHight(doc, options);

    return y;
};

export default renderRawItem;
