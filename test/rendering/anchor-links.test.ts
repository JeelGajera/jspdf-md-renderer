import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import { slugifyHeading, headingPlainText } from '../../src/utils/headingAnchors';
import { RenderStore } from '../../src/store/renderStore';
import { createRenderOptions } from '../helpers/renderOptions';
import { goldenOptions } from '../golden/recorder';
import type { RenderOption } from '../../src/types/renderOption';

type LinkAnnotation = {
    type: string;
    options: { url?: string; pageNumber?: number; top?: number };
};

/**
 * Issue #85 — `[text](#heading)` links jump to the heading inside the PDF.
 *
 * Link annotations live on jsPDF's page context until the document is
 * written, so the tests read them straight from `doc.internal` instead of
 * parsing PDF bytes.
 */
const linkAnnotations = (doc: jsPDF, page: number): LinkAnnotation[] => {
    const pageInfo = (
        doc.internal as unknown as {
            getPageInfo: (n: number) => {
                pageContext: { annotations?: LinkAnnotation[] };
            };
        }
    ).getPageInfo(page);
    return (pageInfo.pageContext.annotations ?? []).filter(
        (a) => a.type === 'link',
    );
};

const silent = (over: Partial<RenderOption> = {}) =>
    goldenOptions({ silent: true, ...over });

describe('anchor links to headings', () => {
    it('slugifies headings GitHub-style', () => {
        expect(slugifyHeading('My Heading')).toBe('my-heading');
        expect(slugifyHeading('My Heading!')).toBe('my-heading');
        expect(slugifyHeading('  API   v2.0  ')).toBe('api-v20');
        expect(slugifyHeading('**Bold** title')).toBe('bold-title');
        expect(slugifyHeading('Café & Bar')).toBe('café-bar');
    });

    it('extracts heading plain text without markup', () => {
        expect(
            headingPlainText({
                type: 'heading',
                items: [
                    { type: 'strong', content: 'Bold', items: [] },
                    { type: 'text', content: ' title' },
                ],
            }),
        ).toBe('Bold title');
    });

    it('resolves a forward link to the heading below it', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(
            doc,
            '[Jump down](#target)\n\n# Target',
            silent(),
        );

        const links = linkAnnotations(doc, 1);
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) {
            // Same page here, and `top` points at the heading's Y rather
            // than jsPDF's default of 0.
            expect(link.options.pageNumber).toBe(1);
            expect(link.options.top).toBeGreaterThan(10);
            expect(link.options.url).toBeUndefined();
        }
    });

    it('jumps a backward link across pages to the right page and position', async () => {
        const filler = Array.from(
            { length: 12 },
            (_, i) => `Filler paragraph ${i} with enough words to take space.`,
        ).join('\n\n');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const result = await MdTextRender(
            doc,
            `# First\n\n${filler}\n\n[Back to start](#first)`,
            silent({
                page: {
                    format: 'a4',
                    unit: 'mm',
                    maxContentWidth: 190,
                    maxContentHeight: 60,
                    topmargin: 10,
                    xpading: 10,
                },
            }),
        );

        expect(result.pageCount).toBeGreaterThan(1);
        const lastPage = doc.getNumberOfPages();
        const links = linkAnnotations(doc, lastPage);
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) {
            expect(link.options.pageNumber).toBe(1);
            // The `# First` heading was drawn at the cursor start (y = 10).
            expect(link.options.top).toBe(10);
        }
    });

    it('gives repeated headings -1, -2 suffixed slugs', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(
            doc,
            '# Repeat\n\n[one](#repeat)\n\n# Repeat\n\n[two](#repeat-1)',
            silent(),
        );

        const links = linkAnnotations(doc, 1);
        expect(links.length).toBeGreaterThan(0);
        // Each link word gets its own annotation, so there are several per
        // link — but only two distinct destinations: the first heading and
        // the second one below it.
        const tops = [...new Set(links.map((l) => l.options.top))].sort(
            (a, b) => (a ?? 0) - (b ?? 0),
        );
        expect(tops.length).toBe(2);
        expect(tops[0]).toBeLessThan(tops[1]!);
    });

    it('keeps the URL behaviour for anchors matching no heading', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(
            doc,
            '# Real\n\n[missing](#no-such-heading)',
            silent(),
        );

        const links = linkAnnotations(doc, 1);
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) {
            expect(link.options.url).toBe('#no-such-heading');
            expect(link.options.pageNumber).toBeUndefined();
        }
    });

    it('dedupes slugs against natural numeric-suffixed headings', () => {
        // Issue #105 review: "A", "A-1", "A" used to assign "a-1" twice,
        // so [go](#a-1) jumped to the last "A" instead of "A-1".
        const store = new RenderStore(createRenderOptions());
        const slugs = ['A', 'A-1', 'A'].map((text, i) =>
            store.registerHeadingAnchor(text, 1, 10 * (i + 1)),
        );
        expect(slugs).toEqual(['a', 'a-1', 'a-2']);

        // Every slug is unique and resolves to its own heading's position.
        expect(new Set(slugs).size).toBe(slugs.length);
        expect(store.getHeadingAnchor('a')?.top).toBe(10);
        expect(store.getHeadingAnchor('a-1')?.top).toBe(20);
        expect(store.getHeadingAnchor('a-2')?.top).toBe(30);
    });

    it('skips naturally occupied suffixes in any order', () => {
        const store = new RenderStore(createRenderOptions());
        // The natural "a-1" is occupied first, so the second "A" must skip it.
        const slugs = ['A-1', 'A', 'A'].map((text, i) =>
            store.registerHeadingAnchor(text, 1, 10 * (i + 1)),
        );
        expect(slugs).toEqual(['a-1', 'a', 'a-2']);
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('dedupes headings whose names already contain numeric suffixes', () => {
        const store = new RenderStore(createRenderOptions());
        const texts = ['Section', 'Section 1', 'Section', 'Section 1 (2)'];
        const slugs = texts.map((text, i) =>
            store.registerHeadingAnchor(text, 1, 10 * (i + 1)),
        );
        expect(slugs).toEqual([
            'section',
            'section-1',
            'section-2',
            'section-1-2',
        ]);
        expect(new Set(slugs).size).toBe(slugs.length);
        // No destination overwrite: each slug keeps its own heading's Y.
        expect(store.getHeadingAnchor('section-1')?.top).toBe(20);
        expect(store.getHeadingAnchor('section-2')?.top).toBe(30);
    });

    it('resolves #a-1 to the A-1 heading, not the repeated A', async () => {
        // Issue #105 review: with headings "A", "A-1", "A", the #a-1 link
        // must jump to the middle heading (A-1), not the last "A".
        const topFor = async (anchor: string): Promise<number> => {
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            await MdTextRender(
                doc,
                `# A\n\n# A-1\n\n# A\n\n[go](${anchor})`,
                silent(),
            );
            const tops = [
                ...new Set(linkAnnotations(doc, 1).map((l) => l.options.top)),
            ];
            expect(tops.length).toBe(1);
            return tops[0] ?? NaN;
        };

        const topA = await topFor('#a');
        const topA1 = await topFor('#a-1');
        const topA2 = await topFor('#a-2');
        // Strict ordering proves each anchor hits its own heading:
        // a -> first A, a-1 -> the A-1 heading, a-2 -> the second A.
        expect(topA).toBeLessThan(topA1);
        expect(topA1).toBeLessThan(topA2);
    });
});
