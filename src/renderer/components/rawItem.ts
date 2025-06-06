import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';
import { justifyText } from '../../utils/justifyText';
import { RenderStore } from '../../store/renderStore';

const renderRawItem = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    hasRawBullet: boolean,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
        start?: number,
        ordered?: boolean,
        justify?: boolean,
    ) => void,
    start: number,
    ordered: boolean,
    justify: boolean = true,
) => {
    if (element?.items && element?.items.length > 0) {
        for (const item of element?.items ?? []) {
            parentElementRenderer(
                item,
                indentLevel,
                hasRawBullet,
                start,
                ordered,
                justify,
            );
        }
    } else {
        const indent = indentLevel * RenderStore.options.page.indent;
        const bullet = hasRawBullet ? (ordered ? `${start}. ` : '\u2022 ') : '';
        if (hasRawBullet && bullet) {
            // Align all wrapped lines with the first line's text (after bullet)
            const bulletWidth = doc.getTextWidth(bullet);
            const textMaxWidth =
                RenderStore.options.page.maxContentWidth - indent - bulletWidth;
            const textLines = doc.splitTextToSize(
                element.content || '',
                textMaxWidth,
            );
            if (textLines.length > 0) {
                // Render bullet
                doc.text(bullet, RenderStore.X + indent, RenderStore.Y, {
                    baseline: 'top',
                });
                // Render first line
                doc.text(
                    textLines[0],
                    RenderStore.X + indent + bulletWidth,
                    RenderStore.Y,
                    {
                        baseline: 'top',
                        maxWidth: textMaxWidth,
                    },
                );
                // Render wrapped lines
                for (let i = 1; i < textLines.length; i++) {
                    RenderStore.updateX(RenderStore.options.page.xpading);
                    RenderStore.updateY(getCharHight(doc, RenderStore.options), 'add');
                    doc.text(
                        textLines[i],
                        RenderStore.X + indent + bulletWidth,
                        RenderStore.Y,
                        {
                            baseline: 'top',
                            maxWidth: textMaxWidth,
                        },
                    );
                }
                // Update cursor position
                RenderStore.updateY(getCharHight(doc, RenderStore.options), 'add');
                RenderStore.updateX(RenderStore.options.page.xpading + indent);
                const contentWidth = doc.getTextWidth(element.content || '');
                RenderStore.updateX(contentWidth, 'add');
            }
        } else {
            const lines = doc.splitTextToSize(
                element.content || '',
                RenderStore.options.page.maxContentWidth - indent,
            );
            if (
                RenderStore.Y + lines.length * getCharHight(doc, RenderStore.options) >=
                RenderStore.options.page.maxContentHeight
            ) {
                HandlePageBreaks(doc, RenderStore.options);
                RenderStore.updateY(RenderStore.options.page.topmargin);
            }
            if (justify) {
                const yPoint =
                    justifyText(
                        doc,
                        element.content || '',
                        RenderStore.X + indent,
                        RenderStore.Y,
                        RenderStore.options.page.maxContentWidth - indent,
                        RenderStore.options.page.defaultLineHeightFactor,
                    ).y + getCharHight(doc, RenderStore.options);
                RenderStore.updateY(yPoint);
                RenderStore.updateX(RenderStore.options.page.xpading);
            } else {
                doc.text(element.content || '', RenderStore.X + indent, RenderStore.Y, {
                    baseline: 'top',
                });
                RenderStore.updateX(doc.getTextWidth(element.content || ''), 'add');
                if (
                    RenderStore.X >=
                    RenderStore.options.page.xpading + RenderStore.options.page.maxContentWidth
                ) {
                    HandlePageBreaks(doc, RenderStore.options);
                    RenderStore.updateX(RenderStore.options.page.xpading);
                    RenderStore.updateY(RenderStore.options.page.topmargin);
                }
            }
        }
    }
};

export default renderRawItem;
