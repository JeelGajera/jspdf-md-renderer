import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender, validateOptions } from '../../src/index';
import type { RenderOption } from '../../src/types/renderOption';
import { goldenOptions, recordDoc } from '../golden/recorder';

/**
 * Item 3 — margin-based page geometry, and item 6 — the option relaxations that
 * make a minimal configuration possible.
 *
 * The content area used to be supplied by hand as `maxContentWidth` and
 * `maxContentHeight`, which had to be kept consistent with the page format
 * manually. The two are not even the same kind of quantity: width is a width,
 * height is the absolute Y coordinate of the content bottom. Deriving both from
 * margins removes that class of mistake.
 */

// jsPDF derives mm from points, so these are not exact integers.
const A4_W = 210.0016;
const A4_H = 297.0000;

const textOps = (ops: ReturnType<typeof recordDoc>['ops']) =>
    ops.filter((o) => o.op === 'text');

describe('page.margin', () => {
    it('derives the content area from the document page size', () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const resolved = validateOptions(
            {
                page: { margin: { top: 15, right: 20, bottom: 25, left: 30 } },
                font: { regular: { name: 'helvetica', style: 'normal' } },
            },
            doc,
        );

        expect(resolved.page.maxContentWidth).toBeCloseTo(A4_W - 30 - 20, 2);
        // An absolute Y bound, not a height.
        expect(resolved.page.maxContentHeight).toBeCloseTo(A4_H - 25, 2);
        expect(resolved.page.topmargin).toBe(15);
        expect(resolved.page.xpading).toBe(30);
        expect(resolved.page.xmargin).toBe(30);
    });

    it('defaults omitted sides to 10', () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const resolved = validateOptions(
            {
                page: { margin: { top: 40 } },
                font: { regular: { name: 'helvetica', style: 'normal' } },
            },
            doc,
        );
        expect(resolved.page.topmargin).toBe(40);
        expect(resolved.page.xpading).toBe(10);
        expect(resolved.page.maxContentWidth).toBeCloseTo(A4_W - 20, 2);
    });

    it('adapts to landscape and to a different page format', () => {
        const landscape = new jsPDF({
            unit: 'mm',
            format: 'a4',
            orientation: 'landscape',
        });
        const resolvedLandscape = validateOptions(
            {
                page: { margin: { top: 10, right: 10, bottom: 10, left: 10 } },
                font: { regular: { name: 'helvetica', style: 'normal' } },
            },
            landscape,
        );
        expect(resolvedLandscape.page.maxContentWidth).toBeCloseTo(A4_H - 20, 0);

        const letter = new jsPDF({ unit: 'pt', format: 'letter' });
        const resolvedLetter = validateOptions(
            {
                page: { margin: { top: 36, right: 36, bottom: 36, left: 36 } },
                font: { regular: { name: 'helvetica', style: 'normal' } },
            },
            letter,
        );
        // US Letter is 612x792pt.
        expect(resolvedLetter.page.maxContentWidth).toBeCloseTo(612 - 72, 0);
        expect(resolvedLetter.page.maxContentHeight).toBeCloseTo(792 - 36, 0);
    });

    it('lets an explicit geometry field win over the derived one', () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const resolved = validateOptions(
            {
                page: {
                    margin: { top: 15, left: 15, right: 15, bottom: 15 },
                    maxContentWidth: 100,
                },
                font: { regular: { name: 'helvetica', style: 'normal' } },
            },
            doc,
        );
        // Explicit width kept, the rest still derived.
        expect(resolved.page.maxContentWidth).toBe(100);
        expect(resolved.page.topmargin).toBe(15);
    });

    it('leaves geometry alone when no document is available', () => {
        const resolved = validateOptions({
            page: { margin: { top: 15, left: 15 }, maxContentWidth: 190 },
            font: { regular: { name: 'helvetica', style: 'normal' } },
        });
        expect(resolved.page.maxContentWidth).toBe(190);
    });

    it('renders correctly using only a margin and a font', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            '# Title\n\nA paragraph of body text that is long enough to wrap.',
            {
                page: { margin: { top: 20, right: 25, bottom: 20, left: 25 } },
                font: { regular: { name: 'helvetica', style: 'normal' } },
            },
        );

        const drawn = textOps(ops);
        expect(drawn.length).toBeGreaterThan(0);
        // Content starts at the margin origin.
        expect(Number(drawn[0].x)).toBeCloseTo(25, 2);
        expect(Number(drawn[0].y)).toBeCloseTo(20, 2);
        // Nothing overflows the right margin.
        for (const op of drawn) {
            expect(Number(op.x)).toBeLessThanOrEqual(A4_W - 25);
        }
    });

    it('keeps content inside the bottom margin across a page break', async () => {
        const { doc, ops } = recordDoc();
        const body = Array.from(
            { length: 90 },
            (_, i) => `Paragraph ${i} with enough words to take up a line.`,
        ).join('\n\n');

        await MdTextRender(doc, body, {
            page: { margin: { top: 20, right: 20, bottom: 40, left: 20 } },
            font: { regular: { name: 'helvetica', style: 'normal' } },
        });

        const pages = (
            doc.internal as unknown as { getNumberOfPages: () => number }
        ).getNumberOfPages();
        expect(pages).toBeGreaterThan(1);

        for (const op of textOps(ops)) {
            expect(Number(op.y)).toBeLessThanOrEqual(A4_H - 40);
            expect(Number(op.y)).toBeGreaterThanOrEqual(20);
        }
    });
});

describe('relaxed option requirements (item 6)', () => {
    it('needs only font.regular', () => {
        const resolved = validateOptions({
            font: { regular: { name: 'helvetica', style: 'normal' } },
        });
        expect(resolved.font.bold.name).toBe('helvetica');
        expect(resolved.font.italic.name).toBe('helvetica');
        expect(resolved.font.code.name).toBe('courier');
        expect(resolved.page.maxContentWidth).toBe(190);
    });

    it('still requires font.regular.name', () => {
        expect(() =>
            validateOptions({} as unknown as RenderOption),
        ).toThrowError(/font.regular.name is required/);
    });

    it('defaults the cursor to the content origin', () => {
        const resolved = validateOptions({
            page: { xpading: 12, topmargin: 18 },
            font: { regular: { name: 'helvetica', style: 'normal' } },
        });
        expect(resolved.cursor).toEqual({ x: 12, y: 18 });
    });

    it('honours an explicit cursor over the derived origin', () => {
        const resolved = validateOptions({
            cursor: { x: 50, y: 60 },
            page: { xpading: 12, topmargin: 18 },
            font: { regular: { name: 'helvetica', style: 'normal' } },
        });
        expect(resolved.cursor).toEqual({ x: 50, y: 60 });
    });

    it('accepts options that omit font.light entirely', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, 'Body text.', {
            font: { regular: { name: 'helvetica', style: 'normal' } },
        });
        expect(textOps(ops).map((o) => o.text)).toEqual(['Body', 'text.']);
    });

    it('ignores font.light when it is supplied', async () => {
        const withLight = recordDoc();
        const withoutLight = recordDoc();

        await MdTextRender(withLight.doc, '# H\n\nText.', {
            ...goldenOptions(),
            font: {
                ...goldenOptions().font,
                light: { name: 'courier', style: 'bold' },
            },
        });
        await MdTextRender(withoutLight.doc, '# H\n\nText.', goldenOptions());

        expect(withLight.transcript()).toBe(withoutLight.transcript());
    });
});

describe('margin edge cases', () => {
    it('clamps a negative margin to zero rather than rendering off-page', () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const resolved = validateOptions(
            {
                page: { margin: { top: -5, left: -5, right: -5, bottom: -5 } },
                font: { regular: { name: 'helvetica', style: 'normal' } },
            },
            doc,
        );
        expect(resolved.page.topmargin).toBe(0);
        expect(resolved.page.xpading).toBe(0);
        // Full page width, never wider than the page itself.
        expect(resolved.page.maxContentWidth).toBeCloseTo(A4_W, 2);
        expect(resolved.page.maxContentHeight).toBeCloseTo(A4_H, 2);
    });

    it('keeps a usable content area when margins exceed the page', () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const resolved = validateOptions(
            {
                page: {
                    margin: { top: 500, right: 500, bottom: 500, left: 500 },
                },
                font: { regular: { name: 'helvetica', style: 'normal' } },
            },
            doc,
        );
        expect(resolved.page.maxContentWidth).toBeGreaterThan(0);
        expect(resolved.page.maxContentHeight).toBeGreaterThan(0);
    });

    it('renders with zero margins', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, 'Edge to edge.', {
            page: { margin: { top: 0, right: 0, bottom: 0, left: 0 } },
            font: { regular: { name: 'helvetica', style: 'normal' } },
            silent: true,
        });
        const drawn = textOps(ops);
        expect(drawn.length).toBeGreaterThan(0);
        expect(Number(drawn[0].x)).toBe(0);
        expect(Number(drawn[0].y)).toBe(0);
    });

    it('does not mutate a reused options object', async () => {
        const options = {
            page: { margin: { top: 10, left: 10 } },
            font: { regular: { name: 'helvetica', style: 'normal' } },
            silent: true,
        };
        const before = JSON.stringify(options);

        await MdTextRender(new jsPDF({ unit: 'mm', format: 'a4' }), '# A', options);
        await MdTextRender(new jsPDF({ unit: 'mm', format: 'a4' }), '# B', options);

        expect(JSON.stringify(options)).toBe(before);
    });
});
