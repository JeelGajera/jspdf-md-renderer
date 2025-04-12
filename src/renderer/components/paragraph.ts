import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { Cursor, RenderOption } from '../../types/renderOption';
import { justifyText } from '../../utils/justifyText';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';

/**
 * Renders paragraph elements.
 */
const renderParagraph = (
    doc: jsPDF,
    element: ParsedElement,
    cursor: Cursor,
    indent: number,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => Cursor,
): Cursor => {
    doc.setFontSize(options.page.defaultFontSize);
    // doc.setFont(options.font.light.name, options.font.light.style);
    let content = element.content;
    const lineHeight =
        doc.getTextDimensions('A').h * options.page.defaultLineHeightFactor;
    if (element?.items && element?.items.length > 0) {
        for (const item of element?.items ?? []) {
            cursor = parentElementRenderer(item, indent, false);
        }
    } else {
        if (
            cursor.y +
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
            const possibleContentY = cursor.y;
            for (let j = 0; j < contentLeft.length; j++) {
                if (cursor.y - 2 * lineHeight < options.page.maxContentHeight) {
                    possibleContentLines.push(contentLeft[j]);
                    cursor.y += options.page.lineSpace;
                } else {
                    // set left content to move next page
                    if (j <= contentLeft.length - 1) {
                        content = contentLeft.slice(j).join('');
                    }
                    break;
                }
            }
            if (possibleContentLines.length > 0) {
                cursor = justifyText(
                    doc,
                    possibleContentLines.join(' '),
                    cursor.x + indent,
                    possibleContentY,
                    options.page.maxContentWidth - indent,
                    options.page.defaultLineHeightFactor,
                );
            }
            HandlePageBreaks(doc, options);
            cursor.y = options.page.topmargin;
        }
        cursor.y =
            justifyText(
                doc,
                content ?? '',
                cursor.x + indent,
                cursor.y,
                options.page.maxContentWidth - indent,
                options.page.defaultLineHeightFactor,
            ).y + getCharHight(doc, options);
        // handle x
        cursor.x = options.page.xpading;
    }

    return cursor;
};

export default renderParagraph;
