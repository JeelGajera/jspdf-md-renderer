import jsPDF from 'jspdf';
import { ResolvedRenderOption } from '../types/renderOption';
import { withSavedDocState } from './doc-helpers';

export const applyPageDecorations = (
    doc: jsPDF,
    options: ResolvedRenderOption,
    fromPage: number = 1,
): void => {
    const totalPages = (
        doc.internal as unknown as { getNumberOfPages: () => number }
    ).getNumberOfPages();

    const start = Math.max(1, Math.min(fromPage, totalPages));

    for (let pageNum = start; pageNum <= totalPages; pageNum++) {
        doc.setPage(pageNum);
        // Render-relative numbering is opt-in (issue #116 follow-up): by
        // default header/footer callbacks keep receiving the document's page
        // numbers, so callers appending sections to one globally numbered
        // document see no change. `pageNumbers: 'render-relative'` numbers
        // pages 1..N of the decorated range instead.
        const relative = options.pageNumbers === 'render-relative';
        const shownPage = relative ? pageNum - start + 1 : pageNum;
        const shownTotal = relative ? totalPages - start + 1 : totalPages;
        applyHeader(doc, options, shownPage, shownTotal);
        applyFooter(doc, options, shownPage, shownTotal);
    }
};

const applyHeader = (
    doc: jsPDF,
    options: ResolvedRenderOption,
    pageNum: number,
    totalPages: number,
): void => {
    const hOpts = options.header;
    if (!hOpts) return;
    const text =
        typeof hOpts.text === 'function'
            ? hOpts.text(pageNum, totalPages)
            : (hOpts.text ?? '');
    if (!text.trim()) return;

    withSavedDocState(doc, () => {
        doc.setFontSize(hOpts.fontSize ?? 9);
        doc.setTextColor(hOpts.color ?? '#666666');

        const y = hOpts.y ?? 5;
        const align = hOpts.align ?? 'center';
        const pageWidth = doc.internal.pageSize.getWidth();
        let x = pageWidth / 2;
        if (align === 'left') x = options.page.xmargin;
        if (align === 'right') x = pageWidth - options.page.xmargin;

        doc.text(text, x, y, { align, baseline: 'top' });
    });
};

const applyFooter = (
    doc: jsPDF,
    options: ResolvedRenderOption,
    pageNum: number,
    totalPages: number,
): void => {
    const fOpts = options.footer;
    if (!fOpts) return;

    const text = fOpts.showPageNumbers
        ? `Page ${pageNum} of ${totalPages}`
        : typeof fOpts.text === 'function'
          ? fOpts.text(pageNum, totalPages)
          : (fOpts.text ?? '');
    if (!text.trim()) return;

    withSavedDocState(doc, () => {
        doc.setFontSize(fOpts.fontSize ?? 9);
        doc.setTextColor(fOpts.color ?? '#666666');

        const pageHeight = doc.internal.pageSize.getHeight();
        const y = fOpts.y ?? pageHeight - 5;
        const align = fOpts.align ?? 'right';
        const pageWidth = doc.internal.pageSize.getWidth();
        let x = pageWidth / 2;
        if (align === 'left') x = options.page.xmargin;
        if (align === 'right') x = pageWidth - options.page.xmargin;

        doc.text(text, x, y, { align, baseline: 'bottom' });
    });
};
