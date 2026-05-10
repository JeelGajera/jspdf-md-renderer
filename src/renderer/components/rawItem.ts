import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderStore } from '../../store/renderStore';
import { breakIfOverflow } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';
import { renderPlainText } from '../../layout';

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
        const listOpts = store.options.list ?? {};
        const bullet = hasRawBullet
            ? ordered
                ? `${start}. `
                : (listOpts.bulletChar ?? '\u2022 ')
            : '';
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
                    getCharHight(doc) * options.page.defaultLineHeightFactor;
                const addedHeight = linesToAdd * lineHeight;

                // Check page break
                breakIfOverflow(doc, store, addedHeight);
                store.updateY(addedHeight, 'add');
                store.recordContentY(store.Y);
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

            renderPlainText(
                doc,
                content,
                xLeft + indent + bulletWidth,
                store.Y,
                textMaxWidth,
                store,
                { alignment: justify ? 'justify' : 'left' },
            );
        } else {
            const textMaxWidth = options.page.maxContentWidth - indent;
            renderPlainText(
                doc,
                content,
                xLeft + indent,
                store.Y,
                textMaxWidth,
                store,
                { alignment: justify ? 'justify' : 'left' },
            );
        }

        // Reset X after block completion
        store.updateX(xLeft, 'set');
    }
};

export default renderRawItem;
