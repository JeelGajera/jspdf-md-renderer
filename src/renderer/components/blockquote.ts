import { jsPDF } from 'jspdf';
import { ParsedElement } from '../../types';
import { RenderStore } from '../../store/renderStore';

const renderBlockquote = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    renderElement: (element: ParsedElement, indentLevel: number) => void,
) => {
    const options = RenderStore.options;

    // Increase indent for blockquote content
    const blockquoteIndent = indentLevel + 1;
    const currentX = RenderStore.X + indentLevel * options.page.indent;
    const currentY = RenderStore.Y;

    // Draw vertical bar for blockquote
    const barX = currentX + options.page.indent / 2;
    const startY = currentY;

    // Track start page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const startPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

    // Render children
    if (element.items && element.items.length > 0) {
        element.items.forEach((item) => {
            renderElement(item, blockquoteIndent);
        });
    }

    const endY = RenderStore.Y;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const endPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

    // Draw the vertical bar across pages
    doc.setDrawColor(100); // Gray color
    doc.setLineWidth(1);

    for (let p = startPage; p <= endPage; p++) {
        doc.setPage(p);
        const isStart = p === startPage;
        const isEnd = p === endPage;

        const lineTop = isStart ? startY : options.page.topmargin;
        const lineBottom = isEnd ? endY : options.page.maxContentHeight;

        doc.line(barX, lineTop, barX, lineBottom);
    }

    // Restore page to endPage
    doc.setPage(endPage);

    // Add some spacing after blockquote
    RenderStore.updateY(options.page.lineSpace, 'add');
};

export default renderBlockquote;
