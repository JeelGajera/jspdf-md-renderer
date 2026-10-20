import { describe, expect, it } from 'vitest';
import jsPDF from 'jspdf';
import { MdTextRender } from '../../src/renderer/MdTextRender';
import { createRenderOptions } from '../helpers/renderOptions';

/** Extracts every "Page X of Y" footer string from a jsPDF document. */
const footerTexts = (doc: jsPDF): string[] => {
    const out = doc.output();
    return [...out.matchAll(/\((Page \d+ of \d+)\)/g)].map((m) => m[1]);
};

describe('footer page numbering (issue #116)', () => {
    it('numbers pages absolutely for a single render (unchanged behaviour)', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const options = createRenderOptions({
            footer: { showPageNumbers: true },
        });
        const longText = Array(60)
            .fill('Lorem ipsum dolor sit amet consectetur adipiscing elit.')
            .join('\n\n');
        const result = await MdTextRender(doc, longText, options);

        expect(result.pageCount).toBeGreaterThan(1);
        const texts = footerTexts(doc);
        expect(texts).toHaveLength(result.pageCount);
        texts.forEach((t, i) =>
            expect(t).toBe(`Page ${i + 1} of ${result.pageCount}`),
        );
    });

    it('numbers appended renders relative to the render, not the document', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const options = createRenderOptions({
            footer: { showPageNumbers: true },
        });

        await MdTextRender(doc, '# First\n\nSome text.', options);

        const longText = Array(60)
            .fill('Lorem ipsum dolor sit amet consectetur adipiscing elit.')
            .join('\n\n');
        const result = await MdTextRender(doc, longText, options);
        expect(result.pageCount).toBeGreaterThan(1);

        const texts = footerTexts(doc);
        expect(texts).toHaveLength(1 + result.pageCount);
        // The appended render's own pages start at 1, not at page 2.
        const appended = texts.slice(1);
        appended.forEach((t, i) =>
            expect(t).toBe(`Page ${i + 1} of ${result.pageCount}`),
        );
    });

    it('passes render-relative numbers to a custom footer text function', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
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

        const longText = Array(60)
            .fill('Lorem ipsum dolor sit amet consectetur adipiscing elit.')
            .join('\n\n');
        const result = await MdTextRender(doc, longText, options);
        expect(result.pageCount).toBeGreaterThan(1);

        expect(seen).toHaveLength(result.pageCount);
        seen.forEach(([pageNumber, totalPages], i) => {
            expect(pageNumber).toBe(i + 1);
            expect(totalPages).toBe(result.pageCount);
        });
    });
});
