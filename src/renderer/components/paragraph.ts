import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';
import { justifyText } from '../../utils/justifyText';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';
import renderInlineText from './inlineText';
import { RenderStore } from '../../store/renderStore';

/**
 * Renders paragraph elements.
 */
const renderParagraph = (
    doc: jsPDF,
    element: ParsedElement,
    indent: number,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => void,
) => {
    doc.setFontSize(options.page.defaultFontSize);
    let content = element.content;
    const lineHeight =
        doc.getTextDimensions('A').h * options.page.defaultLineHeightFactor;
    if (element?.items && element?.items.length > 0) {
        for (const item of element?.items ?? []) {
            if (["strong"].includes(item.type)) {
                renderInlineText(
                    doc,
                    item,
                    indent,
                    options,
                );
            } else {
                parentElementRenderer(item, indent, false);
            }
        }
    } else {
        if (
            RenderStore.Y +
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
            const possibleContentY = RenderStore.Y;
            for (let j = 0; j < contentLeft.length; j++) {
                if (RenderStore.Y - 2 * lineHeight < options.page.maxContentHeight) {
                    possibleContentLines.push(contentLeft[j]);
                    RenderStore.updateY(options.page.lineSpace, 'add');
                } else {
                    // set left content to move next page
                    if (j <= contentLeft.length - 1) {
                        content = contentLeft.slice(j).join('');
                    }
                    break;
                }
            }
            if (possibleContentLines.length > 0) {
                const cursor = justifyText(
                    doc,
                    possibleContentLines.join(' '),
                    RenderStore.X + indent,
                    possibleContentY,
                    options.page.maxContentWidth - indent,
                    options.page.defaultLineHeightFactor,
                );
                RenderStore.setCursor(cursor)
            }
            HandlePageBreaks(doc, options);
            RenderStore.updateY(options.page.topmargin);
        }
        const yPointer =
            justifyText(
                doc,
                content ?? '',
                RenderStore.X + indent,
                RenderStore.Y,
                options.page.maxContentWidth - indent,
                options.page.defaultLineHeightFactor,
            ).y + getCharHight(doc, options);
        RenderStore.updateY(yPointer);
    }

    // Move to next line after paragraph
    RenderStore.updateY(lineHeight, 'add');
    RenderStore.updateX(options.page.xpading)
};

export default renderParagraph;
