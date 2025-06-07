import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { justifyText } from '../../utils/justifyText';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight, getCharWidth } from '../../utils/doc-helpers';
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
    RenderStore.activateInlineLock();
    doc.setFontSize(RenderStore.options.page.defaultFontSize);
    let content = element.content;
    const lineHeight =
        doc.getTextDimensions('A').h *
        RenderStore.options.page.defaultLineHeightFactor;
    if (element?.items && element?.items.length > 0) {
        let idx = 0;
        for (const item of element?.items ?? []) {
            if (
                ['strong', 'em', 'text'].includes(item.type) ||
                RenderStore.isInlineLockActive
            ) {
                if (item.type !== 'text' && idx != 0) {
                    RenderStore.updateX(getCharWidth(doc) * 1.5, 'add');
                }
                renderInlineText(doc, item, indent);
                if (item.type !== 'text' && idx != 0) {
                    RenderStore.updateX(getCharWidth(doc), 'add');
                }
            } else {
                parentElementRenderer(item, indent, false);
            }
            idx++;
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
                if (
                    RenderStore.Y - 2 * lineHeight <
                    RenderStore.options.page.maxContentHeight
                ) {
                    possibleContentLines.push(contentLeft[j]);
                    RenderStore.updateY(
                        RenderStore.options.page.lineSpace,
                        'add',
                    );
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
                RenderStore.setCursor(cursor);
            }
            HandlePageBreaks(doc, RenderStore.options);
        }
        const yPointer =
            justifyText(
                doc,
                content ?? '',
                RenderStore.X + indent,
                RenderStore.Y,
                RenderStore.options.page.maxContentWidth - indent,
                RenderStore.options.page.defaultLineHeightFactor,
            ).y + getCharHight(doc);
        RenderStore.updateY(yPointer);
    }

    // Move to next line after paragraph
    RenderStore.updateY(lineHeight, 'add');
    RenderStore.updateX(RenderStore.options.page.xpading);
    RenderStore.deactivateInlineLock();
};

export default renderParagraph;
