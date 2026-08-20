import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import { goldenOptions } from '../golden/recorder';

/**
 * D5 — a blockquote only learns its height after laying out its children, so
 * its background was emitted afterwards. PDF content streams paint in emission
 * order, so an opaque fill emitted last covered the quote's own text: setting
 * blockquote.backgroundColor erased the text it was meant to sit behind.
 *
 * The golden snapshots cannot catch this, because they record the order calls
 * were made, not the order operations end up in the stream. These tests read
 * the stream directly.
 */

const pageStream = (doc: jsPDF, page = 1): string[] =>
     
    (doc as any).internal.pages[page] as string[];

const firstIndex = (ops: string[], pattern: RegExp): number =>
    ops.findIndex((op) => pattern.test(op));

// A filled rectangle is a `re` operator followed by the fill operator `f`.
const FILL_RECT = /\bre$/;
const TEXT_RUN = /\bTj\b/;

describe('blockquote paint order', () => {
    it('emits the background before the text it sits behind', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });

        await MdTextRender(
            doc,
            '> A quoted paragraph with visible text.',
            goldenOptions({
                blockquote: { backgroundColor: '#EEEEFF', barColor: '#4A90D9' },
            }),
        );

        const ops = pageStream(doc);
        const fillAt = firstIndex(ops, FILL_RECT);
        const textAt = firstIndex(ops, TEXT_RUN);

        expect(fillAt).toBeGreaterThanOrEqual(0);
        expect(textAt).toBeGreaterThanOrEqual(0);
        expect(fillAt).toBeLessThan(textAt);
    });

    it('leaves earlier content on the page untouched', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });

        await MdTextRender(
            doc,
            'Intro paragraph.\n\n> Quoted text.',
            goldenOptions({ blockquote: { backgroundColor: '#EEEEFF' } }),
        );

        const ops = pageStream(doc);
        const introAt = ops.findIndex((op) => op.includes('(Intro)'));
        const fillAt = firstIndex(ops, FILL_RECT);
        const quotedAt = ops.findIndex((op) => op.includes('(Quoted)'));

        // The intro must still precede the blockquote background, which must
        // still precede the quoted text.
        expect(introAt).toBeGreaterThanOrEqual(0);
        expect(fillAt).toBeGreaterThan(introAt);
        expect(quotedAt).toBeGreaterThan(fillAt);
    });

    it('keeps the background behind text on every page it spans', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });

        const long = Array.from(
            { length: 90 },
            (_, i) => `> Quoted line ${i} with enough words to fill the width.`,
        ).join('\n');

        await MdTextRender(
            doc,
            long,
            goldenOptions({ blockquote: { backgroundColor: '#EEEEFF' } }),
        );

        const pages = (
            doc.internal as unknown as { getNumberOfPages: () => number }
        ).getNumberOfPages();
        expect(pages).toBeGreaterThan(1);

        for (let p = 1; p <= pages; p++) {
            const ops = pageStream(doc, p);
            const fillAt = firstIndex(ops, FILL_RECT);
            const textAt = firstIndex(ops, TEXT_RUN);
            if (fillAt >= 0 && textAt >= 0) {
                expect(
                    fillAt,
                    `page ${p}: background must precede text`,
                ).toBeLessThan(textAt);
            }
        }
    });

    it('renders without a background when none is configured', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(doc, '> Plain quote.', goldenOptions());
        const ops = pageStream(doc);
        expect(firstIndex(ops, TEXT_RUN)).toBeGreaterThanOrEqual(0);
    });
});
