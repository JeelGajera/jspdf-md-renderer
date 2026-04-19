import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderStore } from '../../store/renderStore';
import { TextRenderer } from '../../utils/text-renderer';
import { HandlePageBreaks } from '../../utils/handlePageBreak';

const renderRawItem = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    store: RenderStore,
    hasRawBullet: boolean,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        store: RenderStore,
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
                store,
                hasRawBullet,
                start,
                ordered,
                justify,
            );
        }
    } else {
        const options = store.options;
        const indent = indentLevel * options.page.indent;
        const bullet = hasRawBullet ? (ordered ? `${start}. ` : '\u2022 ') : '';
        const content = element.content || '';
        const xLeft = options.page.xpading;

        if (!content && !bullet) return;

        // Smart Whitespace Handling
        // If content is pure whitespace, we check for newlines.
        if (!content.trim() && !bullet) {
            const newlines = (content.match(/\n/g) || []).length;
            // We ignore single newlines (often artifacts between blocks)
            // But we respect double newlines (intentional blank lines)
            // Logic: add (newlines - 1) lines of space
            if (newlines > 1) {
                const linesToAdd = newlines - 1;
                const lineHeight =
                    doc.getTextDimensions('A').h *
                    options.page.defaultLineHeightFactor;
                const addedHeight = linesToAdd * lineHeight;

                // Check page break
                if (store.Y + addedHeight > options.page.maxContentHeight) {
                    HandlePageBreaks(doc, store);
                } else {
                    store.updateY(addedHeight, 'add');
                    store.recordContentY(store.Y);
                }
            }
            return;
        }

        // Reset X to left padding to ensure consistent alignment
        store.updateX(xLeft, 'set');

        if (hasRawBullet && bullet) {
            const bulletWidth = doc.getTextWidth(bullet);
            const textMaxWidth =
                options.page.maxContentWidth - indent - bulletWidth;

            doc.setFont(options.font.regular.name, options.font.regular.style);
            doc.text(bullet, xLeft + indent, store.Y, {
                baseline: 'top',
            });

            TextRenderer.renderText(
                doc,
                content,
                store,
                xLeft + indent + bulletWidth,
                store.Y,
                textMaxWidth,
                justify,
            );
        } else {
            const textMaxWidth = options.page.maxContentWidth - indent;
            TextRenderer.renderText(
                doc,
                content,
                store,
                xLeft + indent,
                store.Y,
                textMaxWidth,
                justify,
            );
        }

        // Reset X after block completion
        store.updateX(xLeft, 'set');
    }
};

export default renderRawItem;
