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

    const relativePageNumbers = options.relativePageNumbers === true;

    for (let pageNum = start; pageNum <= totalPages; pageNum++) {
        doc.setPage(pageNum);
        // Document numbering is preserved by default (backwards compatible):
        // callbacks receive absolute document page numbers so callers
        // appending sections to one document keep a single continuous count.
        // `relativePageNumbers: true` opts into numbering relative to this
        // render's own pages, so an appended render numbers its pages 1..N
        // instead of continuing the document's count (issue #116).
        // For a single render `start` is 1, so both modes agree there.
        const page = relativePageNumbers ? pageNum - start + 1 : pageNum;
        const total = relativePageNumbers ? totalPages - start + 1 : totalPages;
        applyHeader(doc, options, page, total);
        applyFooter(doc, options, page, total);
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
