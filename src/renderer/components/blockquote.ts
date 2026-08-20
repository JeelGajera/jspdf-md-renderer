import { jsPDF } from 'jspdf';
import { ParsedElement } from '../../types';
import { RenderStore } from '../../store/renderStore';
import { getPageOpCount, moveOpsBefore } from '../../utils/content-stream';

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

    // A blockquote only learns how tall it is after laying out its children,
    // so its background can only be drawn afterwards — and a fill emitted after
    // a glyph run paints straight over it. Setting blockquote.backgroundColor
    // therefore used to erase the quote's own text. Remember where this
    // blockquote's content begins on each page so the decorations can be moved
    // behind it once the extent is known.
    const insertAt = new Map<number, number>();
    const startIndex = getPageOpCount(doc, startPage);
    if (startIndex !== null) insertAt.set(startPage, startIndex);

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

    // Any page after the first holds only this blockquote's content, so its
    // decorations belong at the very start of that page's own content.
    for (let p = startPage + 1; p <= endPage; p++) {
        const start = store.getPageContentStart(p);
        if (start !== undefined) insertAt.set(p, start);
    }

    // Where each page's drawing ends before the decorations are emitted.
    const appendedFrom = new Map<number, number>();
    for (let p = startPage; p <= endPage; p++) {
        const count = getPageOpCount(doc, p);
        if (count !== null) appendedFrom.set(p, count);
    }

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

    // Slide the decorations behind the content they enclose.
    for (const [page, from] of appendedFrom) {
        const to = insertAt.get(page);
        if (to !== undefined) moveOpsBefore(doc, page, from, to);
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
