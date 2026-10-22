import { describe, expect, it } from 'vitest';
import jsPDF from 'jspdf';
import { MdTextRender } from '../../src/renderer/MdTextRender';
import { RenderOption } from '../../src/types/renderOption';
import { createRenderOptions } from '../helpers/renderOptions';

const LONG_TEXT = Array(60)
    .fill('Lorem ipsum dolor sit amet consectetur adipiscing elit.')
    .join('\n\n');

/** Renders a one-page section, then a multi-page section, on one document. */
const renderAppended = async (
    overrides: Partial<RenderOption>,
): Promise<{ doc: jsPDF; result: { pageCount: number } }> => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const options = createRenderOptions(overrides);
    await MdTextRender(doc, '# First\n\nSome text.', options);
    // Start the appended section on a fresh page, like a caller appending
    // a new section to one document would.
    doc.addPage();
    const result = await MdTextRender(doc, LONG_TEXT, options);
    expect(result.pageCount).toBeGreaterThan(1);
    return { doc, result };
};

/** Collects every drawn "(...)" literal matching the pattern from the PDF. */
const drawnTexts = (doc: jsPDF, pattern: RegExp): string[] => {
    const out = doc.output();
    return [...out.matchAll(pattern)].map((m) => m[1]);
};

describe('page numbering of header/footer decorations', () => {
    it('footer showPageNumbers uses document numbering by default (backwards compatible)', async () => {
        const { doc, result } = await renderAppended({
            footer: { showPageNumbers: true },
        });

        const total = 1 + result.pageCount;
        const texts = drawnTexts(doc, /\((Page \d+ of \d+)\)/g);
        expect(texts).toHaveLength(total);
        // The appended section continues the document's numbering.
        expect(texts[0]).toBe('Page 1 of 1');
        texts.slice(1).forEach((t, i) => expect(t).toBe(`Page ${i + 2} of ${total}`));
    });

    it('footer showPageNumbers is render-relative when relativePageNumbers is true', async () => {
        const { doc, result } = await renderAppended({
            relativePageNumbers: true,
            footer: { showPageNumbers: true },
        });

        const texts = drawnTexts(doc, /\((Page \d+ of \d+)\)/g);
        // First render's own single page, then the appended render's own pages.
        expect(texts).toHaveLength(1 + result.pageCount);
        expect(texts[0]).toBe('Page 1 of 1');
        texts.slice(1).forEach((t, i) =>
            expect(t).toBe(`Page ${i + 1} of ${result.pageCount}`),
        );
    });

    it('footer text callback receives document numbers by default', async () => {
        const seen: Array<[number, number]> = [];
        const { result } = await renderAppended({
            footer: {
                text: (pageNumber, totalPages) => {
                    seen.push([pageNumber, totalPages]);
                    return `f${pageNumber}/${totalPages}`;
                },
            },
        });

        const total = 1 + result.pageCount;
        // First render decorated page 1; the appended section decorated
        // 2..N with absolute document numbers (historical behaviour).
        expect(seen).toHaveLength(total);
        expect(seen[0]).toEqual([1, 1]);
        seen.slice(1).forEach(([pageNumber, totalPages], i) => {
            expect(pageNumber).toBe(i + 2);
            expect(totalPages).toBe(total);
        });
    });

    it('footer text callback receives render-relative numbers when relativePageNumbers is true', async () => {
        const seen: Array<[number, number]> = [];
        const { result } = await renderAppended({
            relativePageNumbers: true,
            footer: {
                text: (pageNumber, totalPages) => {
                    seen.push([pageNumber, totalPages]);
                    return `f${pageNumber}/${totalPages}`;
                },
            },
        });

        expect(seen).toHaveLength(1 + result.pageCount);
        expect(seen[0]).toEqual([1, 1]);
        seen.slice(1).forEach(([pageNumber, totalPages], i) => {
            expect(pageNumber).toBe(i + 1);
            expect(totalPages).toBe(result.pageCount);
        });
    });

    it('header text callback receives document numbers by default', async () => {
        const seen: Array<[number, number]> = [];
        const { result } = await renderAppended({
            header: {
                text: (pageNumber, totalPages) => {
                    seen.push([pageNumber, totalPages]);
                    return `hdr-${pageNumber}/${totalPages}`;
                },
            },
        });

        const total = 1 + result.pageCount;
        expect(seen).toHaveLength(total);
        expect(seen[0]).toEqual([1, 1]);
        seen.slice(1).forEach(([pageNumber, totalPages], i) => {
            expect(pageNumber).toBe(i + 2);
            expect(totalPages).toBe(total);
        });
    });

    it('header text callback receives render-relative numbers when relativePageNumbers is true', async () => {
        const seen: Array<[number, number]> = [];
        const { result } = await renderAppended({
            relativePageNumbers: true,
            header: {
                text: (pageNumber, totalPages) => {
                    seen.push([pageNumber, totalPages]);
                    return `hdr-${pageNumber}/${totalPages}`;
                },
            },
        });

        expect(seen).toHaveLength(1 + result.pageCount);
        expect(seen[0]).toEqual([1, 1]);
        seen.slice(1).forEach(([pageNumber, totalPages], i) => {
            expect(pageNumber).toBe(i + 1);
            expect(totalPages).toBe(result.pageCount);
        });
    });

    it('single render behaves the same in both modes (start = 1)', async () => {
        for (const relativePageNumbers of [false, true] as const) {
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const options = createRenderOptions({
                relativePageNumbers,
                footer: { showPageNumbers: true },
            });
            const result = await MdTextRender(doc, LONG_TEXT, options);
            expect(result.pageCount).toBeGreaterThan(1);
            const texts = drawnTexts(doc, /\((Page \d+ of \d+)\)/g);
            expect(texts).toHaveLength(result.pageCount);
            texts.forEach((t, i) =>
                expect(t).toBe(`Page ${i + 1} of ${result.pageCount}`),
            );
        }
    });
});
