import { describe, expect, it } from 'vitest';
import { MdTextParser } from '../../src/parser/MdTextParser';
import type { ParsedElement } from '../../src/types/parsedElement';

/**
 * Inline HTML style-tag folding must stay linear.
 *
 * An earlier implementation folded each paired `<tag>`…`</tag>` run by
 * recursing over a sliced copy, re-running pairing over every nested range.
 * That was quadratic: the maintainer's repro (4,000 nested `<b>` tags, ~28
 * KB) took ~2.6 s to convert versus ~11 ms on master. The fold is now
 * iterative, so nested ranges are never rescanned or re-sliced.
 */
describe('inline HTML style-tag folding complexity', () => {
    /** Collect every element type in document order. */
    const flattenTypes = (elements: ParsedElement[]): string[] =>
        elements.flatMap((el) => [
            el.type,
            ...flattenTypes(el.items ?? []),
        ]);

    /** Collect every text/content string in document order. */
    const flattenText = (elements: ParsedElement[]): string =>
        elements
            .map((el) => `${el.content ?? ''}${flattenText(el.items ?? [])}`)
            .join('');

    it('converts the 4,000 nested <b> repro in linear time', async () => {
        // The exact repro from the review: ~28 KB, 4,000 nested tags.
        const md = '<b>'.repeat(4000) + 'x' + '</b>'.repeat(4000);
        expect(Buffer.byteLength(md)).toBeGreaterThan(27_000);

        const start = performance.now();
        const elements = await MdTextParser(md);
        const elapsed = performance.now() - start;

        // The regression took ~2.6 s on the maintainer's machine (and ~10 s
        // on a slower CI VM); the fixed fold runs in milliseconds. 2 s is a
        // generous ceiling that still fails the quadratic implementation.
        expect(elapsed).toBeLessThan(2000);

        // Structure must be unchanged: 4,000 nested strong elements around x.
        expect(flattenTypes(elements).filter((t) => t === 'strong')).toHaveLength(
            4000,
        );
        expect(flattenText(elements)).toContain('x');
    });

    it('stays fast on 4,000 unclosed <b> tags (malformed)', async () => {
        const md = '<b>'.repeat(4000) + 'x';
        const start = performance.now();
        const elements = await MdTextParser(md);
        expect(performance.now() - start).toBeLessThan(2000);
        // Unclosed tags fall through to the HTML handler; the text survives.
        expect(flattenText(elements)).toContain('x');
    });

    it('stays fast on mismatched and stray tags (malformed)', async () => {
        const md = 'A <b>bold</i> C </b> <s>x'.repeat(500);
        const start = performance.now();
        const elements = await MdTextParser(md);
        expect(performance.now() - start).toBeLessThan(2000);
        const text = flattenText(elements);
        expect(text).toContain('A');
        expect(text).toContain('bold');
    });

    it('still nests mixed tags correctly', async () => {
        const elements = await MdTextParser('A <B class="x">bold <i>and</I> it</B> B');
        const types = flattenTypes(elements);
        const strongIdx = types.indexOf('strong');
        expect(strongIdx).toBeGreaterThanOrEqual(0);
        expect(types.slice(strongIdx)).toContain('em');
        expect(flattenText(elements).replace(/\s+/g, ' ')).toContain('bold and it');
    });
});
