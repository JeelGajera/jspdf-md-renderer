import { describe, expect, it, vi } from 'vitest';

const baseOptions = {
    font: { regular: { name: 'helvetica', style: 'normal' } },
    logToConsole: false,
} as const;

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
            font: { regular: { name: 'helvetica', style: 'normal' } },
            link: { underline: true },
            logToConsole: false,
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
            font: { regular: { name: 'helvetica', style: 'normal' } },
            link: { underline: true },
            logToConsole: false,
        });

        expect(result.warnings).toHaveLength(0);
    });

    it('draws one continuous underline across a multi-word link run', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');
        const textSpy = vi.spyOn(doc, 'text');

        await MdTextRender(doc, '[click here now](https://example.com)', {
            ...baseOptions,
            link: { underline: true },
        });

        // One rule for the whole same-link run, not one per word
        expect(lineSpy).toHaveBeenCalledTimes(1);
        const [x1, y1, x2, y2] = lineSpy.mock.calls[0];
        expect(y2).toBe(y1); // horizontal

        const firstWordX = textSpy.mock.calls.find((c) => c[0] === 'click')?.[1];
        const lastWordX = textSpy.mock.calls.find((c) => c[0] === 'now')?.[1];
        // Rule starts where the first word starts ...
        expect(x1).toBeCloseTo(firstWordX as number, 6);
        // ... and ends where the last word ends, covering the spaces between
        expect(x2).toBeCloseTo(
            (lastWordX as number) + doc.getTextWidth('now'),
            4,
        );
        const wordsWidth = ['click', 'here', 'now'].reduce(
            (sum, w) => sum + doc.getTextWidth(w),
            0,
        );
        expect(x2 - x1).toBeGreaterThan(wordsWidth);
    });

    it('keeps distinct links as separate, non-overlapping rules', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');

        await MdTextRender(
            doc,
            '[alpha](https://a.example) [beta](https://b.example)',
            {
                ...baseOptions,
                link: { underline: true },
            },
        );

        expect(lineSpy).toHaveBeenCalledTimes(2);
        const [a1, , a2] = lineSpy.mock.calls[0];
        const [b1, , b2] = lineSpy.mock.calls[1];
        expect(b1).toBeGreaterThan(a1);
        // The boundary between the two links is preserved: rules never overlap
        expect(a2).toBeLessThanOrEqual(b1);
        expect(b2).toBeGreaterThan(b1);
    });

    it('does not merge adjacent links with no space between them', async () => {
        const { renderLine } = await import('../../src/layout/lineRenderer');
        const { RenderStore } = await import('../../src/store/renderStore');
        const { createRenderOptions } = await import('../helpers/renderOptions');
        const { MockDoc } = await import('../helpers/mockDoc');

        const doc = new MockDoc();
        const store = new RenderStore(
            createRenderOptions({ link: { underline: true } }),
        );
        renderLine(
            doc as never,
            {
                words: [
                    {
                        text: 'ab',
                        width: 4,
                        style: 'normal',
                        isLink: true,
                        href: 'https://a.example',
                        linkUnderline: true,
                    },
                    {
                        text: 'cd',
                        width: 4,
                        style: 'normal',
                        isLink: true,
                        href: 'https://b.example',
                        linkUnderline: true,
                    },
                ],
                totalTextWidth: 8,
                isLastLine: true,
                lineHeight: 5,
            },
            10,
            20,
            100,
            store,
        );

        expect(doc.lineCalls).toHaveLength(2);
        // Adjacent but never overlapping
        expect(doc.lineCalls[0].x1).toBe(10);
        expect(doc.lineCalls[0].x2).toBe(14);
        expect(doc.lineCalls[1].x1).toBe(14);
        expect(doc.lineCalls[1].x2).toBe(18);
    });

    it('draws one underline run per line when a link wraps', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');
        const textSpy = vi.spyOn(doc, 'text');

        await MdTextRender(
            doc,
            '[alpha beta gamma delta epsilon zeta eta theta](https://example.com)',
            {
                ...baseOptions,
                page: { maxContentWidth: 60 },
                link: { underline: true },
            },
        );

        const calls = lineSpy.mock.calls;
        // The link wraps: one continuous rule per line-run
        expect(calls.length).toBeGreaterThan(1);
        const ruleYs = [...new Set(calls.map((c) => c[1]))].sort(
            (a, b) => (a as number) - (b as number),
        );
        expect(ruleYs.length).toBe(calls.length);

        // Each line's rule spans exactly its line's words (no gaps, no spill).
        // Words on one rendered line share the exact same text y.
        const linkWords = [
            'alpha',
            'beta',
            'gamma',
            'delta',
            'epsilon',
            'zeta',
            'eta',
            'theta',
        ];
        const textYs = [
            ...new Set(
                textSpy.mock.calls
                    .filter((c) => linkWords.includes(c[0] as string))
                    .map((c) => c[2] as number),
            ),
        ].sort((a, b) => a - b);
        expect(textYs.length).toBe(ruleYs.length);

        for (let i = 0; i < ruleYs.length; i++) {
            const [x1, y1, x2, y2] = calls.find((c) => c[1] === ruleYs[i])!;
            expect(y2).toBe(y1);
            const wordsOnLine = textSpy.mock.calls.filter(
                (c) =>
                    linkWords.includes(c[0] as string) && c[2] === textYs[i],
            );
            expect(wordsOnLine.length).toBeGreaterThan(0);
            const xs = wordsOnLine.map((c) => c[1] as number);
            const lastWord = wordsOnLine.reduce((a, b) =>
                (a[1] as number) > (b[1] as number) ? a : b,
            );
            expect(x1).toBeCloseTo(Math.min(...xs), 4);
            expect(x2).toBeCloseTo(
                (lastWord[1] as number) +
                    doc.getTextWidth(lastWord[0] as string),
                4,
            );
        }
    });

    it('spans stretched word gaps when the line is justified', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');
        const textSpy = vi.spyOn(doc, 'text');

        await MdTextRender(
            doc,
            '[link text here](https://example.com) and more filler words to justify this line fully across the page width with extra content',
            {
                ...baseOptions,
                page: { maxContentWidth: 100 },
                content: { textAlignment: 'justify' },
                link: { underline: true },
            },
        );

        // The link run sits on a justified (non-last) line: still one rule
        expect(lineSpy).toHaveBeenCalledTimes(1);
        const [x1, y1, x2, y2] = lineSpy.mock.calls[0];
        expect(y2).toBe(y1);

        const lastWordX = textSpy.mock.calls.find((c) => c[0] === 'here')?.[1];
        expect(x2).toBeCloseTo(
            (lastWordX as number) + doc.getTextWidth('here'),
            4,
        );
        // The rule covers the stretched gaps: wider than words + normal spaces
        const wordsWidth = ['link', 'text', 'here'].reduce(
            (sum, w) => sum + doc.getTextWidth(w),
            0,
        );
        expect(x2 - x1).toBeGreaterThan(wordsWidth + 2 * doc.getTextWidth(' '));
    });

    it('draws one continuous rule for a styled (bold) link', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');
        const textSpy = vi.spyOn(doc, 'text');

        await MdTextRender(doc, '[**bold** and plain](https://example.com)', {
            ...baseOptions,
            link: { underline: true },
        });

        // Mixed styles inside one link: still a single continuous rule
        expect(lineSpy).toHaveBeenCalledTimes(1);
        const [x1, y1, x2, y2] = lineSpy.mock.calls[0];
        expect(y2).toBe(y1);
        const firstWordX = textSpy.mock.calls.find((c) => c[0] === 'bold')?.[1];
        const lastWordX = textSpy.mock.calls.find((c) => c[0] === 'plain')?.[1];
        expect(x1).toBeCloseTo(firstWordX as number, 6);
        expect(x2).toBeCloseTo(
            (lastWordX as number) + doc.getTextWidth('plain'),
            4,
        );
    });
});
