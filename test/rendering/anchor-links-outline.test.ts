import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import { goldenOptions } from '../golden/recorder';
import type { RenderOption } from '../../src/types/renderOption';

type LinkAnnotation = {
    type: string;
    options: { url?: string; pageNumber?: number; top?: number };
};

type OutlineNode = {
    title: string;
    options?: { pageNumber?: number };
    children: OutlineNode[];
};

/**
 * Rebase integration coverage for #105: heading anchors and the opt-in
 * PDF outline both read headings from the same render, so enabling both
 * must keep anchor links resolving AND outline entries intact.
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

const outlineRoot = (doc: jsPDF): OutlineNode[] =>
    (
        doc as unknown as {
            outline: { root: { children: OutlineNode[] } };
        }
    ).outline.root.children;

const silent = (over: Partial<RenderOption> = {}) =>
    goldenOptions({ silent: true, ...over });

describe('anchor links with the pdf outline enabled', () => {
    it('keeps anchor links resolving and outline entries nested', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(
            doc,
            '# Guide\n\n[Jump to details](#details)\n\n## Details\n\n[Back to guide](#guide)',
            silent({ outline: true }),
        );

        const root = outlineRoot(doc);
        expect(root.map((n) => n.title)).toEqual(['Guide']);
        expect(root[0].children.map((n) => n.title)).toEqual(['Details']);
        expect(root[0].options?.pageNumber).toBe(1);

        const links = linkAnnotations(doc, 1);
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) {
            // Internal jumps, not URL links: both features served by the
            // same heading pass.
            expect(link.options.url).toBeUndefined();
            expect(link.options.pageNumber).toBe(1);
            // The Guide heading is drawn at the cursor start (y = 10).
            expect(link.options.top).toBeGreaterThanOrEqual(10);
        }
        // Two distinct destinations: the Details heading and the Guide one.
        const tops = [...new Set(links.map((l) => l.options.top))];
        expect(tops.length).toBe(2);
    });

    it('keeps outline entries for colliding headings whose anchors dedupe', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(
            doc,
            '# A\n\n# A-1\n\n# A\n\n[third](#a-2)',
            silent({ outline: true }),
        );

        expect(outlineRoot(doc).map((n) => n.title)).toEqual([
            'A',
            'A-1',
            'A',
        ]);

        const links = linkAnnotations(doc, 1);
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) {
            expect(link.options.url).toBeUndefined();
            expect(link.options.pageNumber).toBe(1);
        }
    });
});
