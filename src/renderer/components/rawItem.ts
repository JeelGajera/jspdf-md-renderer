import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { justifyText } from '../../utils/justifyText';

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
    if (
        y +
            doc.splitTextToSize(
                element.content ?? '',
                options.page.maxContentWidth - indent,
            ).length *
                options.page.lineSpace -
            2 * options.page.lineSpace >=
        options.page.maxContentHeight
    ) {
        HandlePageBreaks(options.pageBreakHandler, doc);
    }

    const lineHeight =
        doc.getTextWidth(element.content ?? '') >
        options.page.maxContentWidth - indent
            ? options.page.defaultLineHeightFactor
            : options.page.defaultLineHeightFactor + 0.4;
    const bullet = hasRawBullet ? '\u2022 ' : '';
    y =
        justifyText(
            doc,
            bullet + element.content,
            x + indent,
            y,
            options.page.maxContentWidth - indent,
            lineHeight,
        ) +
        1.5 * options.page.lineSpace;
    return y;
};

export default renderRawItem;
