import { jsPDF } from 'jspdf';
import { ParsedElement } from '../../types';
import { RenderStore } from '../../store/renderStore';

const renderBlockquote = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    store: RenderStore,
    renderElement: (
        element: ParsedElement,
        indentLevel: number,
        store: RenderStore,
    ) => void,
) => {
    const options = store.options;
    const bqOpts = store.options.blockquote ?? {};
    const savedDrawColor = doc.getDrawColor();
    const savedFillColor = doc.getFillColor();
    const savedLineWidth = doc.getLineWidth();

    // Increase indent for blockquote content
    const blockquoteIndent = indentLevel + 1;
    const currentX = store.X + indentLevel * options.page.indent;
    const currentY = store.Y;

    // Draw vertical bar for blockquote
    const barX = currentX + options.page.indent / 2;
    const startY = currentY;

    // Track start page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const startPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

    // Render children
    if (element.items && element.items.length > 0) {
        element.items.forEach((item) => {
            renderElement(item, blockquoteIndent, store);
        });
    }

    const endY = store.lastContentY || store.Y;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const endPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

    // Draw the vertical bar (and optional background) across pages
    const barColor = bqOpts.barColor ?? '#AAAAAA';
    const barWidth = bqOpts.barWidth ?? 1;
    doc.setDrawColor(barColor);
    doc.setLineWidth(barWidth);
    const bgColor = bqOpts.backgroundColor;

    for (let p = startPage; p <= endPage; p++) {
        doc.setPage(p);
        const isStart = p === startPage;
        const isEnd = p === endPage;

        const lineTop = isStart ? startY : options.page.topmargin;
        const lineBottom = isEnd ? endY : options.page.maxContentHeight;
        const lineHeight = Math.max(0, lineBottom - lineTop);

        if (bgColor && lineHeight > 0) {
            // Fill the content gutter to the right of the quote bar.
            const bgX = barX + barWidth / 2;
            const bgW =
                options.page.maxContentWidth - (bgX - options.page.xpading);
            if (bgW > 0) {
                doc.setFillColor(bgColor);
                doc.rect(bgX, lineTop, bgW, lineHeight, 'F');
                doc.setDrawColor(barColor);
            }
        }

        doc.line(barX, lineTop, barX, lineBottom);
    }

    // Ensure the blockquote effectively "claims" the vertical space up to the cursor
    store.recordContentY();

    // Restore page to endPage
    doc.setPage(endPage);

    // Bottom spacing
    const bqBottomSpacing =
        bqOpts.bottomSpacing ??
        options.spacing?.afterBlockquote ??
        options.page.lineSpace;
    store.updateY(bqBottomSpacing, 'add');
    doc.setDrawColor(savedDrawColor);
    doc.setFillColor(savedFillColor);
    doc.setLineWidth(savedLineWidth);
};

export default renderBlockquote;
