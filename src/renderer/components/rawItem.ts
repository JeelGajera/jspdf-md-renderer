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
    const lineHeight =
        doc.getTextDimensions('A').h * options.page.defaultLineHeightFactor;
    if (
        y +
            doc.splitTextToSize(
                element.content ?? '',
                options.page.maxContentWidth - indent,
            ).length *
                lineHeight -
            2 * lineHeight >=
        options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc, options);
        y = options.page.topmargin;
    }

    const lineHeightFactor =
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
            lineHeightFactor,
        ) + lineHeight;
    return y;
};

export default renderRawItem;
