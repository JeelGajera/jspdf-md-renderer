import { describe, expect, it } from 'vitest';
import { MdTextRender, validateOptions } from '../../src/index';
import { goldenOptions, recordDoc } from '../golden/recorder';

/**
 * Group C — behaviour that changes output for documents that already look
 * correct. Both options default to the historical behaviour so that upgrading
 * to 4.2 cannot move anything on an existing user's page; the corrected
 * behaviour is available opt-in and becomes the default in the next major.
 */

const textOps = (ops: ReturnType<typeof recordDoc>['ops']) =>
    ops.filter((o) => o.op === 'text');

const BLANK_LINES_MD = 'First paragraph.\n\n\nSecond paragraph.';
const SOFT_BREAK_MD = 'first line\nsecond line';

describe('spacing.blankLines (D6)', () => {
    it('defaults to preserve, matching 4.1.x output', () => {
        const validated = validateOptions(goldenOptions());
        expect(validated.spacing?.blankLines).toBe('preserve');
    });

    it('preserve keeps the historical extra line of space', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, BLANK_LINES_MD, goldenOptions());

        const ys = textOps(ops).map((o) => Number(o.y));
        const gap = Math.max(...ys) - Math.min(...ys);
        // 3.881 trimmed last line + 3 bottom spacing + two phantom lines of
        // 5.433 from the `\n\n\n` blank-line token.
        expect(gap).toBeCloseTo(3.881 + 3 + 2 * 5.433, 2);
    });

    it('collapse makes spacing.afterParagraph the only gap', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            BLANK_LINES_MD,
            goldenOptions({
                spacing: { blankLines: 'collapse', afterParagraph: 3 },
            }),
        );

        const ys = textOps(ops).map((o) => Number(o.y));
        const gap = Math.max(...ys) - Math.min(...ys);
        // 3.881 trimmed last line + afterParagraph (3). No phantom line.
        expect(gap).toBeCloseTo(3.881 + 3, 2);
    });

    it('collapse makes the gap independent of how many blank lines there are', async () => {
        const gapFor = async (md: string) => {
            const { doc, ops } = recordDoc();
            await MdTextRender(
                doc,
                md,
                goldenOptions({ spacing: { blankLines: 'collapse' } }),
            );
            const ys = textOps(ops).map((o) => Number(o.y));
            return Math.max(...ys) - Math.min(...ys);
        };

        const one = await gapFor('A.\n\nB.');
        const three = await gapFor('A.\n\n\n\nB.');
        expect(one).toBeCloseTo(three, 5);
    });

    it('falls back to preserve for an unrecognised value', () => {
        const validated = validateOptions(
            goldenOptions({
                 
                spacing: { blankLines: 'nonsense' as any },
            }),
        );
        expect(validated.spacing?.blankLines).toBe('preserve');
    });
});

describe('breaks (D15)', () => {
    it('defaults to true, matching 4.1.x output', () => {
        const validated = validateOptions(goldenOptions());
        expect(validated.breaks).toBe(true);
    });

    it('treats a single newline as a hard break by default', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, SOFT_BREAK_MD, goldenOptions());

        const ys = new Set(textOps(ops).map((o) => Number(o.y)));
        expect(ys.size).toBe(2);
    });

    it('breaks:false renders a soft break as a space, per CommonMark', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            SOFT_BREAK_MD,
            goldenOptions({ breaks: false }),
        );

        const drawn = textOps(ops);
        const ys = new Set(drawn.map((o) => Number(o.y)));
        expect(ys.size).toBe(1);

        // Words are separated rather than run together.
        const first = drawn[0];
        const second = drawn[1];
        expect(Number(second.x)).toBeGreaterThan(Number(first.x));
    });

    it('still honours an explicit hard break when breaks is false', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            'first line<br>second line',
            goldenOptions({ breaks: false }),
        );

        const ys = new Set(textOps(ops).map((o) => Number(o.y)));
        expect(ys.size).toBe(2);
    });
});

describe('the two options are independent', () => {
    it('can collapse blank lines while keeping hard breaks', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            'a\nb\n\n\nc',
            goldenOptions({
                spacing: { blankLines: 'collapse' },
                breaks: true,
            }),
        );
        const ys = new Set(textOps(ops).map((o) => Number(o.y)));
        // a and b on separate lines from the hard break, c after the gap.
        expect(ys.size).toBe(3);
    });
});
