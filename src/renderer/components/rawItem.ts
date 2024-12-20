import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';
import { justifyText } from '../../utils/justifyText';

const renderRawItem = (
    doc: jsPDF,
    element: ParsedElement,
    x: number,
    y: number,
    indentLevel: number,
    hasRawBullet: boolean,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => number,
): number => {
    if (element?.items && element?.items.length > 0) {
        for (const item of element?.items ?? []) {
            y = parentElementRenderer(item, indentLevel, hasRawBullet);
        }
    } else {
        const indent = indentLevel * options.page.indent;
        const bullet = hasRawBullet ? '\u2022 ' : ''; // unicode for bullet point
        const lines = doc.splitTextToSize(
            bullet + element.content,
            options.page.maxContentWidth - indent,
        );
        if (
            y + lines.length * getCharHight(doc, options) >=
            options.page.maxContentHeight
        ) {
            HandlePageBreaks(doc, options);
            y = options.page.topmargin;
        }

        y =
            justifyText(
                doc,
                bullet + element.content,
                x + indent,
                y,
                options.page.maxContentWidth - indent,
                options.page.defaultLineHeightFactor,
            ) + getCharHight(doc, options);
        // doc.text(lines, x + indent, y);
        // y += lines.length * getCharHight(doc, options);
    }
    return y;
};

export default renderRawItem;
