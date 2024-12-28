import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';
import { justifyText } from '../../utils/justifyText';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';

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
        start?: number,
        ordered?: boolean,
    ) => number,
    start: number,
    ordered: boolean,
): number => {
    const indent = indentLevel * options.page.indent;
    const bullet = ordered ? `${start}. ` : '\u2022 ';
    if (
        y +
            doc.splitTextToSize(
                element.content ?? '',
                options.page.maxContentWidth - indent,
            ).length *
                getCharHight(doc, options) -
            2 * getCharHight(doc, options) >=
        options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc, options);
        y = options.page.topmargin;
    }
    if (!element.items && element.content) {
        const lineHeight =
            doc.getTextWidth(element.content) >
            options.page.maxContentWidth - indent
                ? options.page.defaultLineHeightFactor
                : options.page.defaultLineHeightFactor + 0.4;
        y =
            justifyText(
                doc,
                bullet + element.content,
                x + indent,
                y,
                options.page.maxContentWidth - indent,
                lineHeight,
            ) + getCharHight(doc, options);
    }
    // Recursively render nested items if they exist
    if (element.items && element.items.length > 0) {
        for (const subItem of element.items) {
            y =
                parentElementRenderer(
                    subItem,
                    indentLevel + 1,
                    true,
                    start,
                    ordered,
                ) +
                getCharHight(doc, options) * 0.2;
        }
    }
    return y;
};

export default renderListItem;
