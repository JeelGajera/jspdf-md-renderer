import { describe, expect, it } from 'vitest';
import { MdTextParser } from '../../src/parser/MdTextParser';
import type { ParsedElement } from '../../src/types/parsedElement';

/**
 * The inline styling-tag folding used to recurse per nested range, re-running
 * the tag pairing over a sliced copy of the inner tokens at every level.
 * 4,000 nested `<b>` tags (~28 KB) took ~2.6 s on the reviewer's machine
 * instead of milliseconds. The folding is now iterative, so the full
 * conversion is linear in the token count. The bound below leaves wide
 * headroom for slow CI (the fixed conversion takes milliseconds) while still
 * failing on the quadratic rescan.
 */
const LIMIT_MS = 2000;
const NESTING_DEPTH = 4000;

const timed = async (fn: () => Promise<unknown>): Promise<number> => {
    const started = Date.now();
    await fn();
    return Date.now() - started;
};

/** Walks down single-child styled wrappers, returning the nesting depth. */
const styledDepth = (node: ParsedElement): number => {
    let depth = 0;
    let current: ParsedElement | undefined = node;
    while (current?.type === 'strong' && current.items?.length === 1) {
        depth++;
        current = current.items[0];
    }
    return depth;
};

describe('nested inline styling-tag complexity', () => {
    it('converts 4,000 nested <b> tags in linear time', async () => {
        const md = '<b>'.repeat(NESTING_DEPTH) + 'x' + '</b>'.repeat(NESTING_DEPTH);
        let parsed: ParsedElement[] = [];
        const elapsed = await timed(async () => {
            parsed = await MdTextParser(md);
        });
        expect(elapsed).toBeLessThan(LIMIT_MS);
        // Styling semantics are unchanged: one paragraph holding 4,000
        // nested strong elements around the text.
        expect(parsed).toHaveLength(1);
        expect(parsed[0].type).toBe('paragraph');
        expect(styledDepth(parsed[0].items?.[0] as ParsedElement)).toBe(
            NESTING_DEPTH,
        );
    });

    it('converts 4,000 unclosed <b> tags in linear time', async () => {
        const md = '<b>'.repeat(NESTING_DEPTH) + 'x';
        let parsed: ParsedElement[] = [];
        const elapsed = await timed(async () => {
            parsed = await MdTextParser(md);
        });
        expect(elapsed).toBeLessThan(LIMIT_MS);
        // No pair ever closes, so nothing folds: the input still parses.
        expect(parsed.length).toBeGreaterThan(0);
    });

    it('converts 2,000 mismatched <b>…</i> pairs in linear time', async () => {
        const md = '<b>x</i>'.repeat(NESTING_DEPTH / 2);
        let parsed: ParsedElement[] = [];
        const elapsed = await timed(async () => {
            parsed = await MdTextParser(md);
        });
        expect(elapsed).toBeLessThan(LIMIT_MS);
        // Mismatched tags never pair, so no styled element is produced.
        expect(parsed.length).toBeGreaterThan(0);
        const hasStrong = JSON.stringify(parsed).includes('"strong"');
        expect(hasStrong).toBe(false);
    });

    it('keeps styling semantics on nested mixed tags', async () => {
        const [node] = await MdTextParser('<b>a<b>b<i>c</i></b></b>');
        expect(node.type).toBe('paragraph');
        const [outer] = node.items ?? [];
        expect(outer.type).toBe('strong');
        expect(outer.content).toBe('');
        const [textA, inner] = outer.items ?? [];
        expect(textA).toMatchObject({ type: 'text', content: 'a' });
        expect(inner.type).toBe('strong');
        const [textB, em] = inner.items ?? [];
        expect(textB).toMatchObject({ type: 'text', content: 'b' });
        expect(em.type).toBe('em');
        expect(em.items?.[0]).toMatchObject({ type: 'text', content: 'c' });
    });
});
