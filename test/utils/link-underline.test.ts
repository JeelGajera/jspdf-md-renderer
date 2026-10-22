import { describe, expect, it, vi } from 'vitest';

const baseOptions = {
    font: { regular: { name: 'helvetica', style: 'normal' } },
    link: { underline: true },
    logToConsole: false,
};

describe('link.underline option', () => {
    it('renders links without underline by default', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');

        await MdTextRender(doc, '[example](https://example.com)', {
            font: { regular: { name: 'helvetica', style: 'normal' } },
            logToConsole: false,
        });

        // No underline drawn by default
        expect(lineSpy).not.toHaveBeenCalled();
    });

    it('draws an underline under link text when link.underline is true', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');

        await MdTextRender(doc, '[example](https://example.com)', {
            ...baseOptions,
        });

        // Underline drawn once for the single link word
        expect(lineSpy).toHaveBeenCalledTimes(1);
        const [x1, y1, x2, y2] = lineSpy.mock.calls[0];
        expect(x2).toBeGreaterThan(x1); // horizontal line spanning the word
        expect(y2).toBe(y1); // horizontal
    });

    it('accepts link.underline without linkColor (linkColor is optional)', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });

        // Type-level: linkColor no longer required; runtime: falls back to blue
        const result = await MdTextRender(doc, '[example](https://example.com)', {
            ...baseOptions,
        });

        expect(result.warnings).toHaveLength(0);
    });

    it('draws one continuous underline for a multi-word link', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');

        await MdTextRender(doc, '[click here now](https://example.com)', {
            ...baseOptions,
        });

        // One rule for the whole same-link run — no gaps at the spaces.
        expect(lineSpy).toHaveBeenCalledTimes(1);
        const [x1, y1, x2, y2] = lineSpy.mock.calls[0];
        expect(y2).toBe(y1); // horizontal
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const wordsWidth =
            doc.getTextWidth('click') +
            doc.getTextWidth('here') +
            doc.getTextWidth('now');
        // The rule must cover the spaces too, not just the word glyphs.
        expect((x2 as number) - (x1 as number)).toBeGreaterThan(wordsWidth);
    });

    it('keeps separate underlines for distinct links', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');

        await MdTextRender(
            doc,
            '[first link](https://one.example) [second link](https://two.example)',
            { ...baseOptions },
        );

        // Two links -> two rules, with the boundary between them preserved.
        expect(lineSpy).toHaveBeenCalledTimes(2);
        const [, , a2] = lineSpy.mock.calls[0];
        const [b1] = lineSpy.mock.calls[1];
        expect(a2 as number).toBeLessThan(b1 as number);
    });

    it('draws a continuous underline per line for wrapped links', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const textSpy = vi.spyOn(doc, 'text');
        const lineSpy = vi.spyOn(doc, 'line');

        await MdTextRender(
            doc,
            '[alpha beta gamma delta epsilon zeta](https://example.com)',
            {
                ...baseOptions,
                page: { maxContentWidth: 40 },
            },
        );

        // Group rendered words by their line.
        const wordsByLine = new Map<number, { x: number; w: number }[]>();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        for (const [text, x, y] of textSpy.mock.calls) {
            const yy = y as number;
            const entry = {
                x: x as number,
                w: doc.getTextWidth(text as string),
            };
            const list = wordsByLine.get(yy) ?? [];
            list.push(entry);
            wordsByLine.set(yy, list);
        }

        // The link wraps: every line carries exactly one continuous rule
        // spanning that line's words.
        expect(wordsByLine.size).toBeGreaterThan(1);
        expect(lineSpy).toHaveBeenCalledTimes(wordsByLine.size);

        const sortedYs = [...wordsByLine.keys()].sort((a, b) => a - b);
        const sortedRules = [...lineSpy.mock.calls].sort(
            (a, b) => (a[1] as number) - (b[1] as number),
        );
        sortedYs.forEach((yy, i) => {
            const words = wordsByLine.get(yy)!;
            const expectedStart = Math.min(...words.map((w) => w.x));
            const expectedEnd = Math.max(...words.map((w) => w.x + w.w));
            const [x1, y1, x2, y2] = sortedRules[i];
            expect(y2).toBe(y1); // horizontal
            expect(x1 as number).toBeCloseTo(expectedStart, 2);
            expect(x2 as number).toBeCloseTo(expectedEnd, 2);
        });
    });

    it('covers the expanded inter-word spaces of a justified link run', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');

        await MdTextRender(
            doc,
            '[click here now](https://example.com) lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt',
            {
                ...baseOptions,
                content: { textAlignment: 'justify' },
            },
        );

        // The link run sits on a justified (non-last) line: a single rule
        // must span the link words plus the expanded spaces between them.
        expect(lineSpy).toHaveBeenCalledTimes(1);
        const [x1, y1, x2, y2] = lineSpy.mock.calls[0];
        expect(y2).toBe(y1); // horizontal
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        expect((x2 as number) - (x1 as number)).toBeGreaterThan(
            doc.getTextWidth('click here now'),
        );
    });

    it('draws one continuous underline across styled link words', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');

        await MdTextRender(doc, '[**bold** and *italic* words](https://example.com)', {
            ...baseOptions,
        });

        // Mixed bold/italic words of one link still get a single rule.
        expect(lineSpy).toHaveBeenCalledTimes(1);
        const [x1, y1, x2, y2] = lineSpy.mock.calls[0];
        expect(y2).toBe(y1); // horizontal
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const wordsWidth =
            doc.getTextWidth('bold') +
            doc.getTextWidth('and') +
            doc.getTextWidth('italic') +
            doc.getTextWidth('words');
        expect((x2 as number) - (x1 as number)).toBeGreaterThan(wordsWidth);
    });
});
