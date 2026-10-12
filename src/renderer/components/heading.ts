// src/renderer/components/heading.ts
import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderStore } from '../../store/renderStore';
import { renderInlineContent, renderPlainText } from '../../layout';
import { getCharHight, withSavedDocState } from '../../utils/doc-helpers';
import {
    currentPageNumber,
    headingPlainText,
} from '../../utils/outline';
import { breakIfOverflow } from '../../utils/handlePageBreak';

const renderHeading = (
    doc: jsPDF,
    element: ParsedElement,
    indent: number,
    store: RenderStore,
) => {
    withSavedDocState(doc, () => {
        const depth = element?.depth ?? 1;
        const headingKey = `h${depth}` as
            'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
        const fontSize =
            store.options.heading?.[headingKey] ??
            store.options.page.defaultTitleFontSize;
        const headingColor =
            store.options.heading?.[`${headingKey}Color`] ??
            store.options.heading?.color ??
            '#000000';
        const useBold = store.options.heading?.bold ?? true;

        doc.setFontSize(fontSize);
        if (useBold) {
            doc.setFont(
                store.options.font.bold.name,
                store.options.font.bold.style || 'bold',
            );
        } else {
            doc.setFont(
                store.options.font.regular.name,
                store.options.font.regular.style || 'normal',
            );
        }
        doc.setTextColor(headingColor);

        breakIfOverflow(doc, store, getCharHight(doc) * 1.8);

        // Opt-in PDF bookmarks: record the heading's depth, plain-text
        // title and page. Read after the page break so the entry points at
        // the page the heading is drawn on.
        const outlineOpt = store.options.outline;
        if (outlineOpt) {
            const maxDepth =
                typeof outlineOpt === 'object' &&
                outlineOpt.maxDepth !== undefined
                    ? Math.max(0, Math.min(6, Math.floor(outlineOpt.maxDepth)))
                    : 6;
            if (depth <= maxDepth) {
                store.addOutlineEntry({
                    depth,
                    title: headingPlainText(element),
                    page: currentPageNumber(doc),
                });
            }
        }

        const maxWidth = store.options.page.maxContentWidth - indent;

        if (element.items && element.items.length > 0) {
            renderInlineContent(
                doc,
                element.items,
                store.X + indent,
                store.Y,
                maxWidth,
                store,
                { alignment: 'left', trimLastLine: true },
            );
        } else {
            renderPlainText(
                doc,
                element?.content ?? '',
                store.X + indent,
                store.Y,
                maxWidth,
                store,
                { alignment: 'left', trimLastLine: true },
            );
        }

        const bottomSpacing =
            store.options.heading?.bottomSpacing ??
            store.options.spacing?.afterHeading ??
            2;
        store.updateY(bottomSpacing, 'add');
    });
    store.updateX(store.options.page.xpading, 'set');
};

export default renderHeading;
