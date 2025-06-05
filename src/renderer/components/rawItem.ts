import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { Cursor, RenderOption } from '../../types/renderOption';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';
import { justifyText } from '../../utils/justifyText';

const renderRawItem = (
    doc: jsPDF,
    element: ParsedElement,
    cursor: Cursor,
    indentLevel: number,
    hasRawBullet: boolean,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
        start?: number,
        ordered?: boolean,
        justify?: boolean,
    ) => Cursor,
    start: number,
    ordered: boolean,
    justify: boolean = true,
): Cursor => {
    if (element?.items && element?.items.length > 0) {
        for (const item of element?.items ?? []) {
            cursor = parentElementRenderer(
                item,
                indentLevel,
                hasRawBullet,
                start,
                ordered,
                justify,
            );
        }
    } else {
        const indent = indentLevel * options.page.indent;
        const bullet = hasRawBullet ? (ordered ? `${start}. ` : '\u2022 ') : '';
        if (hasRawBullet && bullet) {
            // Align all wrapped lines with the first line's text (after bullet)
            const bulletWidth = doc.getTextWidth(bullet);
            const textMaxWidth =
                options.page.maxContentWidth - indent - bulletWidth;
            const textLines = doc.splitTextToSize(
                element.content || '',
                textMaxWidth,
            );
            if (textLines.length > 0) {
                // Render bullet
                doc.text(bullet, cursor.x + indent, cursor.y, {
                    baseline: 'top',
                });
                // Render first line
                doc.text(
                    textLines[0],
                    cursor.x + indent + bulletWidth,
                    cursor.y,
                    {
                        baseline: 'top',
                        maxWidth: textMaxWidth,
                    },
                );
                // Render wrapped lines
                for (let i = 1; i < textLines.length; i++) {
                    cursor.x = options.page.xpading;
                    cursor.y += getCharHight(doc, options);
                    doc.text(
                        textLines[i],
                        cursor.x + indent + bulletWidth,
                        cursor.y,
                        {
                            baseline: 'top',
                            maxWidth: textMaxWidth,
                        },
                    );
                }
                // Update cursor position
                cursor.y += getCharHight(doc, options);
                cursor.x = options.page.xpading + indent;
                const contentWidth = doc.getTextWidth(element.content || '');
                cursor.x += contentWidth;
            }
        } else {
            const lines = doc.splitTextToSize(
                element.content || '',
                options.page.maxContentWidth - indent,
            );
            if (
                cursor.y + lines.length * getCharHight(doc, options) >=
                options.page.maxContentHeight
            ) {
                HandlePageBreaks(doc, options);
                cursor.y = options.page.topmargin;
            }
            if (justify) {
                cursor.y =
                    justifyText(
                        doc,
                        element.content || '',
                        cursor.x + indent,
                        cursor.y,
                        options.page.maxContentWidth - indent,
                        options.page.defaultLineHeightFactor,
                    ).y + getCharHight(doc, options);
                cursor.x = options.page.xpading;
            } else {
                doc.text(element.content || '', cursor.x + indent, cursor.y, {
                    baseline: 'top',
                });
                cursor.x += doc.getTextWidth(element.content || '');
                if (
                    cursor.x >=
                    options.page.xpading + options.page.maxContentWidth
                ) {
                    HandlePageBreaks(doc, options);
                    cursor.x = options.page.xpading;
                    cursor.y = options.page.topmargin;
                }
            }
        }
    }
    return cursor;
};

export default renderRawItem;
