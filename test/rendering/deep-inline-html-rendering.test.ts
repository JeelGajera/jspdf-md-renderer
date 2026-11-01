import { describe, expect, it } from 'vitest';
import { MdTextRender, MdTextParser } from '../../src/index';
import { goldenOptions, recordDoc } from '../golden/recorder';
import { createSecurity } from '../helpers/security';

/**
 * Regression tests for the review feedback on #114: the iterative inline
 * style-tag folding made *parsing* 4,000 nested `<b>` tags fast, but the
 * resulting 4,000-deep styled tree still overflowed the call stack in every
 * recursive downstream traversal (prefetch, flattenToWords), so rendering
 * threw `RangeError: Maximum call stack size exceeded` while master
 * completed. These tests render end to end — they would have caught it,
 * unlike the parse-only complexity tests.
 *
 * Same-style wrappers now collapse at parse time (nested `<b>` folds to a
 * single strong element) and the remaining traversals are iterative, so
 * nesting no implementation can collapse (alternating tags) is safe too.
 */
const textOps = (ops: Array<{ op: string; text?: unknown; font?: unknown }>) =>
    ops.filter((o) => o.op === 'text');

describe('deeply nested inline HTML renders end to end', () => {
    it.each([4000, 8000])(
        'renders %d nested <b> tags (security disabled, reviewer repro)',
        async (depth) => {
            const markdown =
                '<b>'.repeat(depth) + 'x' + '</b>'.repeat(depth);
            const { doc, ops } = recordDoc();
            await MdTextRender(doc, markdown, {
                ...goldenOptions(),
                silent: true,
            });
            const texts = textOps(ops);
            // Same text output as master (verified: master draws ["x"]);
            // bold is this PR's intended styling for the tags.
            expect(texts.map((o) => String(o.text))).toEqual(['x']);
            expect(String(texts[0].font)).toContain('bold');
        },
    );

    it.each([4000, 8000])(
        'renders %d nested <b> tags with security enabled',
        async (depth) => {
            const markdown =
                '<b>'.repeat(depth) + 'x' + '</b>'.repeat(depth);
            const { doc, ops } = recordDoc();
            await MdTextRender(doc, markdown, {
                ...goldenOptions(),
                security: createSecurity(),
                silent: true,
            });
            expect(textOps(ops).map((o) => String(o.text))).toEqual(['x']);
        },
    );

    it('renders alternating <b>/<i> nesting the parser cannot collapse', async () => {
        const depth = 4000;
        const markdown =
            '<b><i>'.repeat(depth) + 'x' + '</i></b>'.repeat(depth);
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, markdown, {
            ...goldenOptions(),
            security: createSecurity(),
            silent: true,
        });
        expect(textOps(ops).map((o) => String(o.text))).toEqual(['x']);
    });

    it('collapses redundant same-style wrappers at parse time', async () => {
        const [paragraph] = await MdTextParser(
            '<b>'.repeat(4000) + 'x' + '</b>'.repeat(4000),
        );
        expect(paragraph.type).toBe('paragraph');
        const [strong] = paragraph.items ?? [];
        expect(strong.type).toBe('strong');
        expect(strong.items?.map((i) => i.content).join('')).toBe('x');
    });
});

describe('malformed inline HTML renders end to end', () => {
    it.each([
        ['unclosed tags', '<b>'.repeat(4000) + 'x'],
        ['mismatched pairs', '<b>x</i>'.repeat(2000)],
        [
            'unclosed alternating tags',
            '<b><i>'.repeat(2000) + 'x',
        ],
        [
            'mixed malformed soup',
            '<b>a<i>b</b>c</i>d<strong>e</b>f',
        ],
    ])('%s render without throwing (security disabled)', async (_name, md) => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, md, { ...goldenOptions(), silent: true });
        expect(doc.getNumberOfPages()).toBeGreaterThan(0);
        // No content silently lost to a crash: something was drawn.
        expect(textOps(ops).length).toBeGreaterThan(0);
    });

    it.each([
        ['unclosed tags', '<b>'.repeat(4000) + 'x'],
        ['mismatched pairs', '<b>x</i>'.repeat(2000)],
        [
            'unclosed alternating tags',
            '<b><i>'.repeat(2000) + 'x',
        ],
    ])('%s render without throwing (security enabled)', async (_name, md) => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, md, {
            ...goldenOptions(),
            security: createSecurity(),
            silent: true,
        });
        expect(doc.getNumberOfPages()).toBeGreaterThan(0);
        expect(textOps(ops).length).toBeGreaterThan(0);
    });

    it('keeps surrounding text when malformed tags interleave it', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, 'before <b>bold <i>both</b> after', {
            ...goldenOptions(),
            silent: true,
        });
        const drawn = textOps(ops)
            .map((o) => String(o.text))
            .join(' ');
        expect(drawn).toContain('before');
        expect(drawn).toContain('after');
    });
});
