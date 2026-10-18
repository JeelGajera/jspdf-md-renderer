import { describe, expect, it } from 'vitest';
import { MdTextRender, MdTextParser } from '../../src/index';
import { goldenOptions, recordDoc } from '../golden/recorder';

/**
 * `<s>` and `<del>` are the HTML equivalents of GFM `~~…~~`. They used to
 * fall through to plain text, so the strikethrough styling was silently
 * lost while `<strong>`/`<em>` kept theirs.
 */
describe('html strikethrough (<s>/<del>)', () => {
    it.each([
        ['<s>struck</s>', 's'],
        ['<del>struck</del>', 'del'],
        ['<DEL>struck</DEL>', 'DEL (uppercase)'],
        ['<s class="x">struck</s>', 's with attributes'],
    ])('parses %s to a del node', async (html) => {
        const [paragraph] = (await MdTextParser(
            `A ${html} B`,
            undefined as never,
        )) as Array<{ items: Array<{ type: string; items?: Array<{ content?: string }> }> }>;
        const del = paragraph.items.find((i) => i.type === 'del');
        expect(del).toBeDefined();
        expect(
            (del!.items ?? []).map((i) => i.content).join(''),
        ).toBe('struck');
    });

    it.each(['<s>struck</s>', '<del>struck</del>'])(
        'draws a strikethrough rule for %s',
        async (html) => {
            const { doc, ops } = recordDoc();
            await MdTextRender(doc, `A ${html} B`, goldenOptions());

            const text = ops
                .filter((o) => o.op === 'text')
                .map((o) => String(o.text));
            expect(text).toContain('struck');
            expect(text.some((t) => t.includes('<'))).toBe(false);

            // The struck word gets a rule drawn across it, exactly like
            // `~~struck~~` does.
            const word = ops.find(
                (o) => o.op === 'text' && o.text === 'struck',
            );
            expect(word).toBeDefined();
            const rule = ops.find(
                (o) =>
                    o.op === 'line' &&
                    Math.abs(Number(o.x1) - Number(word!.x)) < 0.5 &&
                    Number(o.x2) > Number(o.x1),
            );
            expect(rule).toBeDefined();
        },
    );

    it('matches the markdown ~~…~~ rendering', async () => {
        const htmlRender = recordDoc();
        await MdTextRender(htmlRender.doc, 'A <s>struck</s> B', goldenOptions());
        const mdRender = recordDoc();
        await MdTextRender(mdRender.doc, 'A ~~struck~~ B', goldenOptions());

        const strikeOps = (ops: typeof htmlRender.ops) =>
            ops.filter((o) => o.op === 'line');
        expect(strikeOps(htmlRender.ops)).toHaveLength(
            strikeOps(mdRender.ops).length,
        );
        expect(strikeOps(htmlRender.ops)).toHaveLength(1);
    });
});
