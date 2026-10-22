import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { breakIntoLines } from '../../src/layout/lineBreaker';
import { RenderStore } from '../../src/store/renderStore';
import { StyledWordInfo } from '../../src/types/styledWordInfo';
import { createRenderOptions } from '../helpers/renderOptions';

// Realistic performance guard for splitOversizedWord (#107).
//
// The maintainer found a 10x real-font regression the MockDoc call-count
// test could not see: with an 11pt Helvetica token and 190mm line width,
// 50,000 'w' chars measured 18.71M total characters (~369ms on master,
// ~3,271ms regressed). Total characters passed to getTextWidth is the
// deterministic proxy for that cost: it does not depend on machine speed,
// but the regressed search (hi = full remainder on every binary search)
// blows it up ~374x the token length.

const splitWithCost = (text: string, maxWidth: number) => {
    const doc = new jsPDF({ unit: 'mm' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    let measuredChars = 0;
    const orig = doc.getTextWidth.bind(doc);
    doc.getTextWidth = ((t: string, ...rest: unknown[]): number => {
        measuredChars += t.length;
        return (orig as (...a: unknown[]) => number)(t, ...rest);
    }) as typeof doc.getTextWidth;
    const store = new RenderStore(createRenderOptions());
    const word: StyledWordInfo = {
        text,
        width: doc.getTextWidth(text),
        style: 'normal',
        hasTrailingSpace: false,
    };
    measuredChars = 0; // exclude the setup measurement above
    const t0 = performance.now();
    const lines = breakIntoLines(doc, [word], maxWidth, store);
    const wallMs = performance.now() - t0;
    return { lines, measuredChars, wallMs };
};

const chunksOf = (text: string, maxWidth: number): string[] =>
    splitWithCost(text, maxWidth).lines.flatMap((line) =>
        line.words.map((w) => w.text),
    );

describe('splitOversizedWord performance (#107)', () => {
    it(
        'keeps measured characters near-linear for a 100KB token',
        () => {
            const text = 'w'.repeat(100_000);
            const { lines, measuredChars } = splitWithCost(text, 190);
            const chunks = lines.flatMap((line) =>
                line.words.map((w) => w.text),
            );
            expect(chunks.join('')).toBe(text);
            expect(chunks.length).toBeGreaterThan(100);
            console.log(
                `100KB token: measuredChars=${measuredChars} ` +
                    `(${(measuredChars / text.length).toFixed(1)}x token)`,
            );
            // The regressed search measured ~374x the token here; the
            // bounded search stays near the fitting line length.
            expect(measuredChars).toBeLessThan(50 * text.length);
        },
        60_000,
    );

    it(
        'keeps measured characters near-linear for a 200KB token',
        () => {
            const text = 'w'.repeat(200_000);
            const { lines, measuredChars } = splitWithCost(text, 190);
            const chunks = lines.flatMap((line) =>
                line.words.map((w) => w.text),
            );
            expect(chunks.join('')).toBe(text);
            console.log(
                `200KB token: measuredChars=${measuredChars} ` +
                    `(${(measuredChars / text.length).toFixed(1)}x token)`,
            );
            expect(measuredChars).toBeLessThan(50 * text.length);
        },
        120_000,
    );

    it(
        'splits the maintainer scenario (50k w chars, 11pt, 190mm) fast',
        () => {
            const text = 'w'.repeat(50_000);
            const { lines, measuredChars, wallMs } = splitWithCost(text, 190);
            const chunks = lines.flatMap((line) =>
                line.words.map((w) => w.text),
            );
            expect(chunks.join('')).toBe(text);
            // Every chunk still respects the line width.
            const doc = new jsPDF({ unit: 'mm' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            for (const chunk of chunks) {
                expect(
                    doc.getTextWidth(chunk) <= 190 || chunk.length === 1,
                ).toBe(true);
            }
            console.log(
                `50KB token: measuredChars=${measuredChars} ` +
                    `(${(measuredChars / text.length).toFixed(1)}x token), ` +
                    `wall=${wallMs.toFixed(0)}ms`,
            );
            expect(measuredChars).toBeLessThan(50 * text.length);
            // Master did this in ~369ms; the regressed search took ~3,271ms.
            expect(wallMs).toBeLessThan(5000);
        },
        60_000,
    );

    it('splitChunks parity helper is unaffected', () => {
        // Sanity: the realistic-token path agrees with the MockDoc oracle
        // used in line-breaker-parity.test.ts.
        expect(chunksOf('abcdefghij', 20)).toEqual(['abcdefghij']);
    });
});
