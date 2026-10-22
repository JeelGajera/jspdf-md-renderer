import { describe, expect, it } from 'vitest';
import jsPDF from 'jspdf';
import { MdTextRender } from '../../src/renderer/MdTextRender';
import { RenderOption } from '../../src/types/renderOption';
import { createRenderOptions } from '../helpers/renderOptions';

const LOREM = 'Lorem ipsum dolor sit amet consectetur adipiscing elit.';
const multiPage = (paragraphs: number): string =>
    Array(paragraphs).fill(LOREM).join('\n\n');

/** Extracts every "Page X of Y" footer string from a jsPDF document. */
const footerTexts = (doc: jsPDF): string[] => {
    const out = doc.output();
    return [...out.matchAll(/\((Page \d+ of \d+)\)/g)].map((m) => m[1]);
};

const currentPageOf = (doc: jsPDF): number =>
    (
        doc as unknown as {
            internal: { getCurrentPageInfo: () => { pageNumber: number } };
        }
    ).internal?.getCurrentPageInfo?.()?.pageNumber ?? 1;

const newDoc = (): jsPDF => new jsPDF({ unit: 'mm', format: 'a4' });

/**
 * Renders a filler part that fills more than one page, then appends a long
 * second render, collecting the header/footer callback arguments of the
 * second render only. The second render starts mid-document, which is the
 * case that distinguishes document numbering from render-relative numbering.
 */
const renderAppended = async (overrides: Partial<RenderOption>) => {
    const doc = newDoc();
    const seenHeader: Array<[number, number]> = [];
    const seenFooter: Array<[number, number]> = [];
    const options = createRenderOptions({
        header: {
            text: (pageNumber, totalPages) => {
                seenHeader.push([pageNumber, totalPages]);
                return `H${pageNumber}/${totalPages}`;
            },
        },
        footer: {
            text: (pageNumber, totalPages) => {
                seenFooter.push([pageNumber, totalPages]);
                return `F${pageNumber}/${totalPages}`;
            },
        },
        ...overrides,
    });

    await MdTextRender(doc, multiPage(40), options);
    const startPage = currentPageOf(doc);
    // Premise guards: the appended render really does start mid-document.
    expect(startPage).toBe(doc.getNumberOfPages());
    expect(startPage).toBeGreaterThan(1);
    seenHeader.length = 0;
    seenFooter.length = 0;

    const result = await MdTextRender(doc, multiPage(60), options);
    const total = doc.getNumberOfPages();
    expect(total).toBeGreaterThan(startPage);

    return { seenHeader, seenFooter, startPage, total, produced: result.pageCount };
};

describe('footer page numbering (issue #116)', () => {
    it('numbers pages absolutely for a single render (unchanged behaviour)', async () => {
        const doc = newDoc();
        const options = createRenderOptions({
            footer: { showPageNumbers: true },
        });
        const result = await MdTextRender(doc, multiPage(60), options);

        expect(result.pageCount).toBeGreaterThan(1);
        const texts = footerTexts(doc);
        expect(texts).toHaveLength(result.pageCount);
        texts.forEach((t, i) =>
            expect(t).toBe(`Page ${i + 1} of ${result.pageCount}`),
        );
    });

    it('keeps document numbering for appended renders by default', async () => {
        const doc = newDoc();
        const options = createRenderOptions({
            footer: { showPageNumbers: true },
        });

        await MdTextRender(doc, '# First\n\nSome text.', options);

        const result = await MdTextRender(doc, multiPage(60), options);
        expect(result.pageCount).toBeGreaterThan(1);
        const total = doc.getNumberOfPages();

        const texts = footerTexts(doc);
        expect(texts).toHaveLength(1 + total);
        // The first render's footer is untouched...
        expect(texts[0]).toBe('Page 1 of 1');
        // ...and the appended render continues the document's numbering.
        texts.slice(1).forEach((t, i) => expect(t).toBe(`Page ${i + 1} of ${total}`));
    });

    it('passes document page numbers to a custom footer text function by default', async () => {
        const doc = newDoc();
        const seen: Array<[number, number]> = [];
        const options = createRenderOptions({
            footer: {
                text: (pageNumber, totalPages) => {
                    seen.push([pageNumber, totalPages]);
                    return `p${pageNumber}/${totalPages}`;
                },
            },
        });

        await MdTextRender(doc, '# First\n\nSome text.', options);
        seen.length = 0;

        const result = await MdTextRender(doc, multiPage(60), options);
        expect(result.pageCount).toBeGreaterThan(1);
        const total = doc.getNumberOfPages();

        expect(seen).toHaveLength(total);
        seen.forEach(([pageNumber, totalPages], i) => {
            expect(pageNumber).toBe(i + 1);
            expect(totalPages).toBe(total);
        });
    });
});

describe('header/footer page-numbering modes', () => {
    it('uses document numbering for header and footer callbacks by default', async () => {
        const { seenHeader, seenFooter, startPage, total } =
            await renderAppended({});

        expect(seenHeader).toHaveLength(total - startPage + 1);
        expect(seenFooter).toHaveLength(total - startPage + 1);

        // Existing callback arguments are unchanged: absolute document
        // page numbers and the document's total page count.
        seenHeader.forEach(([pageNumber, totalPages], i) => {
            expect(pageNumber).toBe(startPage + i);
            expect(totalPages).toBe(total);
        });
        seenFooter.forEach(([pageNumber, totalPages], i) => {
            expect(pageNumber).toBe(startPage + i);
            expect(totalPages).toBe(total);
        });
    });

    it("numbers the appended render's own pages with pageNumbers: 'render-relative'", async () => {
        const { seenHeader, seenFooter, startPage, total, produced } =
            await renderAppended({ pageNumbers: 'render-relative' });
        const own = total - startPage + 1;
        expect(produced).toBe(own);

        // Both the header and the footer callback see the render's own
        // pages 1..N and the render's own total.
        expect(seenHeader).toHaveLength(own);
        expect(seenFooter).toHaveLength(own);
        seenHeader.forEach(([pageNumber, totalPages], i) => {
            expect(pageNumber).toBe(i + 1);
            expect(totalPages).toBe(own);
        });
        seenFooter.forEach(([pageNumber, totalPages], i) => {
            expect(pageNumber).toBe(i + 1);
            expect(totalPages).toBe(own);
        });
    });

    it("applies pageNumbers: 'render-relative' to the showPageNumbers shortcut", async () => {
        const doc = newDoc();
        const options = createRenderOptions({
            pageNumbers: 'render-relative',
            footer: { showPageNumbers: true },
        });

        await MdTextRender(doc, multiPage(40), options);
        const startPage = currentPageOf(doc);
        expect(startPage).toBeGreaterThan(1);

        const result = await MdTextRender(doc, multiPage(60), options);
        const texts = footerTexts(doc);

        // Part 1 started on page 1, so its own numbering is untouched; the
        // appended render's footers number its own pages 1..N.
        const appended = texts.slice(startPage);
        expect(appended).toHaveLength(result.pageCount);
        appended.forEach((t, i) =>
            expect(t).toBe(`Page ${i + 1} of ${result.pageCount}`),
        );
    });
});
