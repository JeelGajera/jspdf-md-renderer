import { describe, expect, it } from 'vitest';
import { MdTextRender, MdTextParser } from '../../src/index';
import { goldenOptions, recordDoc } from '../golden/recorder';

/**
 * A task list's `[ ]`/`[x]` marker arrives from marked as its own
 * `checkbox` token. The list-item renderer draws the checkbox itself, so
 * the marker token must render nothing — it used to fall through to the
 * generic branch and print literal "[ ]" text next to the drawn box.
 */
describe('task list checkbox marker', () => {
    it('parses the checkbox token to a noop', async () => {
        const [list] = (await MdTextParser(
            '- [ ] todo\n- [x] done\n',
            undefined as never,
        )) as Array<{
            items: Array<{ items: Array<{ type: string }> }>;
        }>;
        for (const item of list.items) {
            expect(
                item.items.some((i) => i.type === 'raw'),
            ).toBe(false);
            expect(item.items.some((i) => i.type === 'noop')).toBe(true);
        }
    });

    it('does not print the [ ]/[x] marker text', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            '- [ ] todo\n- [x] done\n',
            goldenOptions(),
        );

        const text = ops
            .filter((o) => o.op === 'text')
            .map((o) => String(o.text));
        expect(text).toContain('todo');
        expect(text).toContain('done');
        expect(text.some((t) => t.includes('['))).toBe(false);
        expect(text.some((t) => t.includes(']'))).toBe(false);
    });

    it('still draws the checkbox boxes', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            '- [ ] todo\n- [x] done\n',
            goldenOptions(),
        );

        // One outer box per task item.
        const boxes = ops.filter((o) => o.op === 'rect');
        expect(boxes.length).toBe(2);
    });

    it('still draws the checkmark for checked items', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, '- [x] done\n', goldenOptions());

        // The checkmark is two short line segments inside the box.
        const box = ops.find((o) => o.op === 'rect');
        expect(box).toBeDefined();
        const marks = ops.filter(
            (o) =>
                o.op === 'line' &&
                Number(o.x1) >= Number(box!.x) &&
                Number(o.x2) <= Number(box!.x) + Number(box!.w),
        );
        expect(marks.length).toBe(2);
    });
});
