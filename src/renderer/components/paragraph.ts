import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';
import { justifyText } from '../../utils/justifyText';
import { HandlePageBreaks } from '../../utils/handlePageBreak';

/**
 * Renders paragraph elements.
 */
const renderParagraph = (
    doc: jsPDF,
    element: ParsedElement,
    x: number,
    y: number,
    indent: number,
    options: RenderOption,
): number => {
    doc.setFontSize(options.page.defaultFontSize);
    // doc.setFont(options.font.light.name, options.font.light.style);
    let content = element.content;
    const lineHeight =
        doc.getTextDimensions('A').h * options.page.defaultLineHeightFactor;
    if (
        y +
            doc.splitTextToSize(
                content ?? '',
                options.page.maxContentWidth - indent,
            ).length *
                lineHeight -
            3 * lineHeight >=
        options.page.maxContentHeight
    ) {
        // ADD Possible text to Page bottom
        const contentLeft: string[] = doc.splitTextToSize(
            content ?? '',
            options.page.maxContentWidth - indent,
        );
        const possibleContentLines: string[] = [];
        const possibleContentY = y;
        for (let j = 0; j < contentLeft.length; j++) {
            if (y - 2 * lineHeight < options.page.maxContentHeight) {
                possibleContentLines.push(contentLeft[j]);
                y += options.page.lineSpace;
            } else {
                // set left content to move next page
                if (j <= contentLeft.length - 1) {
                    content = contentLeft.slice(j).join('');
                }
                break;
            }
        }
        if (possibleContentLines.length > 0) {
            y = justifyText(
                doc,
                possibleContentLines.join(' '),
                x + indent,
                possibleContentY,
                options.page.maxContentWidth - indent,
                options.page.defaultLineHeightFactor,
            );
        }
        HandlePageBreaks(doc, options);
        y = options.page.topmargin;
    }
    y =
        justifyText(
            doc,
            content ?? '',
            x + indent,
            y,
            options.page.maxContentWidth - indent,
            options.page.defaultLineHeightFactor,
        ) + options.page.lineSpace;

    return y;
};

export default renderParagraph;
