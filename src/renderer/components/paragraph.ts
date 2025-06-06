import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
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
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => void,
) => {
    doc.setFontSize(RenderStore.options.page.defaultFontSize);
    let content = element.content;
    const lineHeight =
        doc.getTextDimensions('A').h * RenderStore.options.page.defaultLineHeightFactor;
    if (element?.items && element?.items.length > 0) {
        for (const item of element?.items ?? []) {
            if (["strong"].includes(item.type)) {
                renderInlineText(
                    doc,
                    item,
                    indent
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
                RenderStore.options.page.maxContentWidth - indent,
            ).length *
            lineHeight -
            3 * lineHeight >=
            RenderStore.options.page.maxContentHeight
        ) {
            // ADD Possible text to Page bottom
            const contentLeft: string[] = doc.splitTextToSize(
                content ?? '',
                RenderStore.options.page.maxContentWidth - indent,
            );
            const possibleContentLines: string[] = [];
            const possibleContentY = RenderStore.Y;
            for (let j = 0; j < contentLeft.length; j++) {
                if (RenderStore.Y - 2 * lineHeight < RenderStore.options.page.maxContentHeight) {
                    possibleContentLines.push(contentLeft[j]);
                    RenderStore.updateY(RenderStore.options.page.lineSpace, 'add');
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
                    RenderStore.options.page.maxContentWidth - indent,
                    RenderStore.options.page.defaultLineHeightFactor,
                );
                RenderStore.setCursor(cursor)
            }
            HandlePageBreaks(doc, RenderStore.options);
            RenderStore.updateY(RenderStore.options.page.topmargin);
        }
        const yPointer =
            justifyText(
                doc,
                content ?? '',
                RenderStore.X + indent,
                RenderStore.Y,
                RenderStore.options.page.maxContentWidth - indent,
                RenderStore.options.page.defaultLineHeightFactor,
            ).y + getCharHight(doc, RenderStore.options);
        RenderStore.updateY(yPointer);
    }

    // Move to next line after paragraph
    RenderStore.updateY(lineHeight, 'add');
    RenderStore.updateX(RenderStore.options.page.xpading)
};

export default renderParagraph;
