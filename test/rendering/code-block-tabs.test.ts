import { describe, expect, it } from 'vitest';
import { MdTextRender } from '../../src/index';
import { createRenderOptions } from '../helpers/renderOptions';
import { recordDoc } from '../golden/recorder';

const renderCode = async (markdown: string, tabSize?: number) => {
    const rec = recordDoc();
    await MdTextRender(
        rec.doc,
        markdown,
        createRenderOptions({ silent: true, codeBlock: { tabSize } as any }),
    );
    return rec.ops.filter((o) => o.op === 'text').map((o) => String(o.text));
};

describe('code block tab expansion (issue #76)', () => {
    it('expands mid-line tabs to tab stops', async () => {
        const texts = await renderCode('```\nab\tc\nabcd\te\n```');
        expect(texts).toContain('ab  c');
        expect(texts).toContain('abcd    e');
    });

    it('honours a custom tabSize', async () => {
        const texts = await renderCode('```\na\tb\n```', 2);
        expect(texts).toContain('a b');
    });

    it.each([0, -4, 2.5, NaN, 1e9])(
        'falls back to default expansion for invalid tabSize %p',
        async (bad) => {
            const texts = await renderCode('```\nab\tc\n```', bad as number);
            expect(texts).toContain('ab  c'); // default tabSize 4
        },
    );
});
