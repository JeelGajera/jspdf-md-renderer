import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import { setWordRunMergingEnabled } from '../../src/layout/lineRenderer';
import { goldenOptions } from '../golden/recorder';
import { extractPdfWords } from '../helpers/pdf-glyphs';

/**
 * Issue #111: PDF-level glyph-position regression for word-run merging.
 *
 * Merging same-style words into one `doc.text` call must not move any glyph.
 * A total-width `getTextWidth` guard cannot prove that: a viewer shapes a
 * plain `(w1 w2) Tj` with the font's real advance widths (Adobe AFM for the
 * 14 standard fonts), while jsPDF measures with its own width tables plus
 * kerning pairs no viewer applies — so per-word origins drifted by up to
 * ~3.7pt even when the totals matched.
 *
 * This test renders every golden fixture twice — with merging on and with
 * the pre-PR per-word path forced — parses the actual PDF bytes, and
 * asserts every word lands within 0.01pt of its old x. It fails on the
 * total-width guard and passes once the per-word-position guard is in place.
 */

const FIXTURE_DIR = join(__dirname, '..', 'golden', 'fixtures');
const TOLERANCE_PT = 0.01;

const renderPdf = async (
    markdown: string,
    mergeRuns: boolean,
): Promise<ArrayBuffer> => {
    setWordRunMergingEnabled(mergeRuns);
    try {
        const doc = new jsPDF({
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
        });
        await MdTextRender(doc, markdown, goldenOptions());
        return doc.output('arraybuffer') as ArrayBuffer;
    } finally {
        setWordRunMergingEnabled(true);
    }
};

describe('glyph-position regression (issue #111)', () => {
    const fixtures = readdirSync(FIXTURE_DIR)
        .filter((f) => f.endsWith('.md'))
        .sort();

    afterEach(() => {
        setWordRunMergingEnabled(true);
    });

    it('has the full fixture corpus', () => {
        expect(fixtures.length).toBeGreaterThanOrEqual(24);
    });

    for (const fixture of fixtures) {
        it(`keeps glyph x within 0.01pt on ${fixture}`, async () => {
            const markdown = readFileSync(join(FIXTURE_DIR, fixture), 'utf-8');
            const merged = extractPdfWords(await renderPdf(markdown, true));
            const perWord = extractPdfWords(await renderPdf(markdown, false));

            expect(merged.map((w) => w.word)).toEqual(
                perWord.map((w) => w.word),
            );

            let maxDx = 0;
            const moved: string[] = [];
            for (let i = 0; i < perWord.length; i++) {
                const dx = Math.abs(merged[i].xPt - perWord[i].xPt);
                const dy = Math.abs(merged[i].yPt - perWord[i].yPt);
                maxDx = Math.max(maxDx, dx);
                if (dx > TOLERANCE_PT || dy > TOLERANCE_PT) {
                    moved.push(
                        `${JSON.stringify(perWord[i].word)}: ` +
                            `dx=${dx.toFixed(4)}pt dy=${dy.toFixed(4)}pt`,
                    );
                }
            }
            expect(
                moved.slice(0, 10),
                `max dx=${maxDx.toFixed(4)}pt over ${perWord.length} words`,
            ).toEqual([]);
        });
    }
});
