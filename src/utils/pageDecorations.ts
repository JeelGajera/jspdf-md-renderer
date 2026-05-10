import jsPDF from 'jspdf';
import { RenderOption } from '../types/renderOption';

export const applyPageDecorations = (
    doc: jsPDF,
    options: RenderOption,
): void => {
    const totalPages = (
        doc.internal as unknown as { getNumberOfPages: () => number }
    ).getNumberOfPages();

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        doc.setPage(pageNum);
        applyHeader(doc, options, pageNum, totalPages);
        applyFooter(doc, options, pageNum, totalPages);
    }
};

const applyHeader = (
    doc: jsPDF,
    options: RenderOption,
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

    const savedFont = doc.getFont();
    const savedSize = doc.getFontSize();
    const savedColor = doc.getTextColor();

    doc.setFontSize(hOpts.fontSize ?? 9);
    doc.setTextColor(hOpts.color ?? '#666666');

    const y = hOpts.y ?? 5;
    const align = hOpts.align ?? 'center';
    const pageWidth = doc.internal.pageSize.getWidth();
    let x = pageWidth / 2;
    if (align === 'left') x = options.page.xmargin;
    if (align === 'right') x = pageWidth - options.page.xmargin;

    doc.text(text, x, y, { align, baseline: 'top' });

    doc.setFont(savedFont.fontName, savedFont.fontStyle);
    doc.setFontSize(savedSize);
    doc.setTextColor(savedColor);
};

const applyFooter = (
    doc: jsPDF,
    options: RenderOption,
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

    const savedFont = doc.getFont();
    const savedSize = doc.getFontSize();
    const savedColor = doc.getTextColor();

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

    doc.setFont(savedFont.fontName, savedFont.fontStyle);
    doc.setFontSize(savedSize);
    doc.setTextColor(savedColor);
};
