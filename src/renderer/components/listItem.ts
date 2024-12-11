import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';
import { justifyText } from '../../utils/justifyText';
import { HandlePageBreaks } from '../../utils/handlePageBreak';

const renderListItem = (
    doc: jsPDF,
    element: ParsedElement,
    x: number,
    y: number,
    indentLevel: number,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => void,
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
    if (element.content) {
        const lineHeight =
            doc.getTextWidth(element.content) >
            options.page.maxContentWidth - indent
                ? options.page.defaultLineHeightFactor
                : options.page.defaultLineHeightFactor + 0.4;
        y =
            justifyText(
                doc,
                '\u2022 ' + element.content,
                x + indent,
                y,
                options.page.maxContentWidth - indent,
                lineHeight,
            ) +
            1.5 * options.page.lineSpace;
    }
    // Recursively render nested items if they exist
    if (element.items && element.items.length > 0) {
        for (const subItem of element.items) {
            parentElementRenderer(subItem, indentLevel + 1, true);
        }
    }
    return y;
};

export default renderListItem;
