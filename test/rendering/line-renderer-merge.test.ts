import { describe, expect, it } from 'vitest';
import { MdTextRender } from '../../src/index';
import { recordDoc } from '../golden/recorder';

/**
 * Issue #88: consecutive words of the same style on a non-justified line are
 * drawn with one `doc.text` call. Glyph positions must not move: the merged
 * run starts at the first word's coordinates and occupies exactly the width
 * the layout assumed.
 */

const MINIMAL = {
    page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
    font: { regular: { name: 'helvetica', style: 'normal' } },
    silent: true,
};

// Courier's jsPDF widths match the viewer AFM widths exactly (and it has no
// kerning pairs), so the issue #111 per-word guard lets courier runs merge.
const COURIER_MINIMAL = {
    ...MINIMAL,
    font: { regular: { name: 'courier', style: 'normal' } },
};

const texts = (ops: ReturnType<typeof recordDoc>['ops']) =>
    ops.filter((o) => o.op === 'text');

const byLine = (ops: ReturnType<typeof recordDoc>['ops']) => {
    const groups = new Map<string, typeof ops>();
    for (const o of texts(ops)) {
        const key = `${o.page}:${o.y}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(o);
    }
    return [...groups.values()].map((g) =>
        g.sort((a, b) => (a.x as number) - (b.x as number)),
    );
};

describe('renderLine word-run merging (issue #88)', () => {
    it('draws a same-style courier line with one text call', async () => {
        const { doc, ops } = recordDoc();
        const result = await MdTextRender(doc, 'hello world foo', COURIER_MINIMAL);

        expect(result.warnings).toEqual([]);
        const t = texts(ops);
        expect(t).toHaveLength(1);
        expect(t[0].text).toBe('hello world foo');
        // Starts where the first word did: the left content edge.
        expect(t[0].x).toBeCloseTo(20, 3);
    });

    it('falls back to per-word calls when merging would move glyphs (issue #111)', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, 'hello world foo', MINIMAL);

        const t = texts(ops);
        // Helvetica's jsPDF widths differ from the AFM widths a viewer
        // shapes with, so the per-word guard refuses to merge: every word
        // keeps exactly the x the pre-PR loop gave it.
        expect(t.map((o) => o.text)).toEqual(['hello', 'world', 'foo']);
        const xs = t.map((o) => o.x as number);
        expect(xs[0]).toBeCloseTo(20, 3);
        expect(xs[1]).toBeGreaterThan(xs[0]);
        expect(xs[2]).toBeGreaterThan(xs[1]);
    });

    it('breaks the run when the style changes', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, '**bold** plain *em*', MINIMAL);

        const t = texts(ops);
        expect(t.map((o) => o.text)).toEqual(['bold', 'plain', 'em']);
        // Same baseline, strictly increasing x.
        expect(new Set(t.map((o) => o.y)).size).toBe(1);
        const xs = t.map((o) => o.x as number);
        expect(xs[0]).toBeLessThan(xs[1]);
        expect(xs[1]).toBeLessThan(xs[2]);
    });

    it('keeps word-by-word drawing on justified lines', async () => {
        const { doc, ops } = recordDoc();
        const result = await MdTextRender(
            doc,
            'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor.',
            {
                ...MINIMAL,
                content: { textAlignment: 'justify' as const },
            },
        );

        expect(result.warnings).toEqual([]);
        const lines = byLine(ops);
        expect(lines.length).toBeGreaterThan(1);
        // Non-last justified lines stretch spaces, so every word keeps its
        // own call and no text op contains a space.
        for (const line of lines.slice(0, -1)) {
            expect(line.length).toBeGreaterThan(1);
            for (const o of line) {
                expect(o.text as string).not.toContain(' ');
            }
        }
    });

    it('merges the last line of a justified paragraph', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore.',
            {
                ...COURIER_MINIMAL,
                content: { textAlignment: 'justify' as const },
            },
        );

        const lines = byLine(ops);
        const last = lines[lines.length - 1];
        if (last.length > 1) {
            // The last line uses normal spacing, so it merges like left
            // alignment: a single call per style run.
            expect(
                last.filter((o) => (o.text as string).includes(' ')).length,
            ).toBeGreaterThan(0);
        }
    });

    it('keeps link annotations per word at their exact positions', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, '[click here](https://example.com) now', {
            ...MINIMAL,
        });

        const t = texts(ops);
        // Helvetica falls back to per-word calls (issue #111); each link
        // annotation still tiles its own word exactly.
        expect(t.map((o) => o.text)).toEqual(['click', 'here', 'now']);
        const links = ops.filter((o) => o.op === 'link');
        expect(links).toHaveLength(2);
        expect(links[0].x).toBe(t[0].x);
        expect(links[1].x).toBe(t[1].x);
        expect((links[1].x as number)).toBeGreaterThan(links[0].x as number);
        expect(links[1].y).toBe(t[0].y);
    });

    it('keeps codespan backgrounds per word', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, 'Use `git` and `status` now', MINIMAL);

        const t = texts(ops);
        expect(t.map((o) => o.text)).toEqual([
            'Use',
            'git',
            'and',
            'status',
            'now',
        ]);
        const rects = ops.filter((o) => o.op === 'rect');
        // One background per codespan word, at each word's own x minus the
        // background padding (0.8).
        expect(rects).toHaveLength(2);
        expect(rects[0].x as number).toBeCloseTo((t[1].x as number) - 0.8, 3);
        expect(rects[1].x as number).toBeCloseTo((t[3].x as number) - 0.8, 3);
    });

    it('keeps strikethrough rules per word', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, '~~old text~~ new', MINIMAL);

        const t = texts(ops);
        // Helvetica falls back to per-word calls (issue #111).
        expect(t.map((o) => o.text)).toEqual(['old', 'text', 'new']);
        const rules = ops.filter((o) => o.op === 'line');
        expect(rules).toHaveLength(2);
        // Each rule starts at its word's x and spans that word only.
        expect(rules[0].x1).toBe(t[0].x);
        expect(rules[1].x1).toBe(t[1].x);
        expect(rules[1].x1 as number).toBeGreaterThan(rules[0].x1 as number);
        expect(rules[1].x2 as number).toBeGreaterThan(rules[1].x1 as number);
    });

    it('does not merge across inline images', async () => {
        const { doc, ops } = recordDoc();
        // A 1px png data URI keeps the fixture self-contained.
        const img =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        await MdTextRender(doc, `before ![x](${img}) after`, MINIMAL);

        const t = texts(ops).filter((o) => (o.text as string).length > 0);
        expect(t.map((o) => o.text)).toEqual(['before', 'after']);
        expect(ops.some((o) => o.op === 'image')).toBe(true);
    });

    it('merges right- and center-aligned lines without moving the start', async () => {
        for (const align of ['right', 'center'] as const) {
            const { doc, ops } = recordDoc();
            await MdTextRender(doc, 'one two three', {
                ...COURIER_MINIMAL,
                content: { textAlignment: align },
            });
            const t = texts(ops);
            expect(t).toHaveLength(1);
            expect(t[0].text).toBe('one two three');
            // The merged run starts at the aligned line start, not at x=20.
            expect(t[0].x as number).toBeGreaterThan(20);
        }
    });
});
