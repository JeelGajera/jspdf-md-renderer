import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import { goldenOptions } from '../golden/recorder';

type OutlineNode = {
    title: string;
    options?: { pageNumber?: number };
    children: OutlineNode[];
};

/**
 * Issue #84 — opt-in PDF bookmarks (outline) generated from headings.
 *
 * jsPDF builds the outline tree on `doc.outline` during `output()`, so the
 * tests inspect that tree directly, as the issue's "done when" asks.
 */
const outlineRoot = (doc: jsPDF): OutlineNode[] =>
    (
        doc as unknown as {
            outline: { root: { children: OutlineNode[] } };
        }
    ).outline.root.children;

const silent = (over: Record<string, unknown> = {}) =>
    goldenOptions({ silent: true, ...over });

const titles = (nodes: OutlineNode[]): unknown[] =>
    nodes.map((n) => [n.title, titles(n.children)]);

describe('pdf outline from headings', () => {
    it('is off by default', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(doc, '# A\n\n## B', silent());

        expect(outlineRoot(doc)).toEqual([]);
    });

    it('creates one nested entry per heading pointing at the right page', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(
            doc,
            '# Alpha\n\n## Beta\n\n## Gamma\n\n# Delta',
            silent({ outline: true }),
        );

        const root = outlineRoot(doc);
        expect(titles(root)).toEqual([
            ['Alpha', [['Beta', []], ['Gamma', []]]],
            ['Delta', []],
        ]);
        expect(root[0].options?.pageNumber).toBe(1);
        expect(root[0].children[0].options?.pageNumber).toBe(1);
    });

    it('nests a deeper heading under the nearest preceding shallower one', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(
            doc,
            '# A\n\n### Skipped a level\n\n## Back up',
            silent({ outline: true }),
        );

        const root = outlineRoot(doc);
        expect(titles(root)).toEqual([
            ['A', [['Skipped a level', []], ['Back up', []]]],
        ]);
    });

    it('limits included levels with maxDepth', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(
            doc,
            '# A\n\n## B\n\n### C',
            silent({ outline: { maxDepth: 2 } }),
        );

        const root = outlineRoot(doc);
        expect(titles(root)).toEqual([['A', [['B', []]]]]);
    });

    it('uses the heading plain text without markup', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(
            doc,
            '# **Bold** and `code` title',
            silent({ outline: true }),
        );

        expect(outlineRoot(doc)[0].title).toBe('Bold and code title');
    });

    it('points entries at the page each heading was drawn on', async () => {
        const filler = Array.from(
            { length: 12 },
            (_, i) => `Filler paragraph ${i} with enough words to take space.`,
        ).join('\n\n');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const result = await MdTextRender(
            doc,
            `# First\n\n${filler}\n\n# Second`,
            silent({
                outline: true,
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
        const root = outlineRoot(doc);
        expect(root.map((n) => n.title)).toEqual(['First', 'Second']);
        expect(root[0].options?.pageNumber).toBe(1);
        expect(root[1].options?.pageNumber).toBeGreaterThan(1);
    });

    it('adds entries alongside an existing outline on a second render', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(doc, '# First render', silent({ outline: true }));
        await MdTextRender(doc, '# Second render', silent({ outline: true }));

        expect(outlineRoot(doc).map((n) => n.title)).toEqual([
            'First render',
            'Second render',
        ]);
    });

    it('emits the outline into the PDF output', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(
            doc,
            '# Alpha\n\n## Beta',
            silent({ outline: true }),
        );

        const output = doc.output();
        expect(output).toContain('/Outlines');
        expect(output).toContain('/Title (Alpha)');
        expect(output).toContain('/Title (Beta)');
    });
});
