import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import { RenderStore } from '../../src/store/renderStore';
import { createRenderOptions } from '../helpers/renderOptions';
import { slugifyHeading, headingPlainText } from '../../src/utils/headingAnchors';
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

    describe('slug collision handling', () => {
        const register = (store: RenderStore, text: string) =>
            store.registerHeadingAnchor(text, 1, store.Y);

        it('assigns a, a-1, a-2 to headings A, A-1, A (reviewer repro)', () => {
            const store = new RenderStore(createRenderOptions());
            expect(register(store, 'A')).toBe('a');
            // The natural numeric suffix is claimed by the A-1 heading, so
            // the second A must skip over it instead of overwriting it.
            expect(register(store, 'A-1')).toBe('a-1');
            expect(register(store, 'A')).toBe('a-2');
        });

        it('increments past an occupied natural numeric suffix', () => {
            const store = new RenderStore(createRenderOptions());
            expect(register(store, 'A')).toBe('a');
            expect(register(store, 'A')).toBe('a-1');
            // `a-1` is taken, so the natural `a-1` increments its own base.
            expect(register(store, 'A-1')).toBe('a-1-1');
        });

        it('never assigns the same slug twice, even with nested suffixes', () => {
            const store = new RenderStore(createRenderOptions());
            const texts = ['A', 'A-1', 'A', 'A-2', 'A', 'A-1'];
            const slugs = texts.map((t) => register(store, t));
            expect(slugs).toEqual([
                'a',
                'a-1',
                'a-2',
                'a-2-1',
                'a-3',
                'a-1-1',
            ]);
            expect(new Set(slugs).size).toBe(slugs.length);
        });

        it('routes each #a-n link to the right heading position', async () => {
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            await MdTextRender(
                doc,
                '# A\n\n[go-a](#a)\n\n# A-1\n\n[go-a-1](#a-1)\n\n# A\n\n[go-a-2](#a-2)',
                silent(),
            );

            const links = linkAnnotations(doc, 1);
            expect(links.length).toBeGreaterThan(0);
            // Before the fix, a-1 was assigned twice: go-a-1 and go-a-2
            // both jumped to the third heading. Now the three destinations
            // are the three distinct headings, in order.
            const tops = [...new Set(links.map((l) => l.options.top))].sort(
                (a, b) => (a ?? 0) - (b ?? 0),
            );
            expect(tops.length).toBe(3);
            expect(tops[0]).toBeLessThan(tops[1]!);
            expect(tops[1]).toBeLessThan(tops[2]!);
        });
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
});
