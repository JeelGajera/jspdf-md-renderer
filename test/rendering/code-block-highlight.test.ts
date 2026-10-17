import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import { recordDoc } from '../golden/recorder';

/**
 * Issue #86: `codeBlock.highlight` lets callers colour code tokens while the
 * built-in renderer keeps the layout.
 */

const MINIMAL = {
    page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
    font: { regular: { name: 'helvetica', style: 'normal' } },
    silent: true,
};

/**
 * jsPDF normalises hex colours when they are set (e.g. `#CF222E` reads back
 * as `#cf212d`), so resolve the expected recorded value through a real doc
 * instead of hard-coding jsPDF's internal rounding.
 */
const recordedColor = (hex: string): string => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setTextColor(hex);
    return doc.getTextColor();
};

const codeTexts = (ops: ReturnType<typeof recordDoc>['ops']) =>
    ops.filter((o) => o.op === 'text' && o.font === 'courier/normal');

describe('codeBlock.highlight', () => {
    it('draws each run in its colour', async () => {
        const keywordColor = recordedColor('#CF222E');
        const { doc, ops } = recordDoc();
        const result = await MdTextRender(doc, '```js\nconst x = 1\n```', {
            ...MINIMAL,
            codeBlock: {
                highlight: (code) =>
                    code.split('\n').map((line) => [
                        { text: 'const', color: '#CF222E' },
                        { text: line.slice('const'.length) },
                    ]),
            },
        });

        expect(result.warnings).toEqual([]);
        const texts = codeTexts(ops);
        expect(texts.some((t) => t.color === keywordColor)).toBe(true);
        expect(texts.some((t) => t.color === '#000000')).toBe(true);
        // The coloured fragment sits at the line start; the rest follows it
        // on the same baseline, tiling the line exactly.
        const keyword = texts.find((t) => t.color === keywordColor)!;
        const rest = texts.find(
            (t) => t.color === '#000000' && t.y === keyword.y,
        )!;
        expect(rest.x as number).toBeGreaterThan(keyword.x as number);
        expect(
            texts.map((t) => t.text as string).join(''),
        ).toContain('const x = 1');
    });

    it('keeps each run colour across wrapped lines', async () => {
        const red = 'r'.repeat(100);
        const blue = 'b'.repeat(100);
        const redColor = recordedColor('#FF0000');
        const blueColor = recordedColor('#0000FF');
        const { doc, ops } = recordDoc();
        const result = await MdTextRender(doc, '```\n' + red + blue + '\n```', {
            ...MINIMAL,
            codeBlock: {
                highlight: () => [
                    [
                        { text: red, color: '#FF0000' },
                        { text: blue, color: '#0000FF' },
                    ],
                ],
            },
        });

        expect(result.warnings).toEqual([]);
        const texts = codeTexts(ops).filter(
            (t) => (t.text as string).length > 0,
        );
        // The line wrapped, so there is more than one text op...
        expect(texts.length).toBeGreaterThan(1);
        // ...every fragment is uniformly one colour, and the colour changes
        // at most once: all red fragments precede all blue ones, i.e. no run
        // leaked into the other's fragments.
        const colours = texts.map((t) => t.color as string);
        expect(new Set(colours)).toEqual(new Set([redColor, blueColor]));
        const firstBlue = colours.indexOf(blueColor);
        expect(colours.slice(firstBlue).every((c) => c === blueColor)).toBe(
            true,
        );
        // Nothing was dropped or duplicated by the wrapping.
        expect(texts.map((t) => t.text as string).join('')).toBe(red + blue);
    });

    it('keeps colours on blocks that span pages', async () => {
        const linkColor = recordedColor('#1F6FEB');
        const lines = Array.from({ length: 80 }, (_, i) => `line ${i} = ${i}`).join(
            '\n',
        );
        const { doc, ops } = recordDoc();
        const result = await MdTextRender(doc, '```\n' + lines + '\n```', {
            ...MINIMAL,
            codeBlock: {
                highlight: (code) =>
                    code.split('\n').map((line) => [
                        { text: line, color: '#1F6FEB' },
                    ]),
            },
        });

        expect(result.warnings).toEqual([]);
        expect(result.pageCount).toBeGreaterThan(1);
        const page2 = codeTexts(ops).filter((t) => t.page === 2);
        expect(page2.length).toBeGreaterThan(0);
        expect(page2.every((t) => t.color === linkColor)).toBe(true);
    });

    it('matches the unhighlighted layout when the hook adds no colours', async () => {
        const markdown =
            '```js\nconst value = 1;\nfunction example(input) {\n  return input * 2;\n}\n```';
        const plain = recordDoc();
        await MdTextRender(plain.doc, markdown, MINIMAL);
        const highlighted = recordDoc();
        await MdTextRender(highlighted.doc, markdown, {
            ...MINIMAL,
            codeBlock: {
                highlight: (code) =>
                    code.split('\n').map((line) => [{ text: line }]),
            },
        });

        expect(plain.transcript()).toBe(highlighted.transcript());
    });

    it('falls back with a warning when the hook throws', async () => {
        const { doc, ops } = recordDoc();
        const result = await MdTextRender(doc, '```\nhello\n```', {
            ...MINIMAL,
            codeBlock: {
                highlight: () => {
                    throw new Error('boom');
                },
            },
        });

        expect(result.warnings.map((w) => w.code)).toContain(
            'CODE_HIGHLIGHT_FAILED',
        );
        expect(
            codeTexts(ops).map((t) => t.text as string).join(''),
        ).toContain('hello');
    });

    it('falls back with a warning when the hook returns the wrong line count', async () => {
        const { doc } = recordDoc();
        const result = await MdTextRender(doc, '```\none\ntwo\n```', {
            ...MINIMAL,
            codeBlock: {
                highlight: () => [[{ text: 'one' }]],
            },
        });

        expect(result.warnings.map((w) => w.code)).toContain(
            'CODE_HIGHLIGHT_FAILED',
        );
    });

    it('falls back per line when runs do not tile the source text', async () => {
        const redColor = recordedColor('#FF0000');
        const { doc, ops } = recordDoc();
        const result = await MdTextRender(doc, '```\nok line\nbad line\n```', {
            ...MINIMAL,
            codeBlock: {
                highlight: (code) =>
                    code.split('\n').map((line, i) =>
                        i === 0
                            ? [{ text: line, color: '#FF0000' }]
                            : [{ text: 'corrupted', color: '#FF0000' }],
                    ),
            },
        });

        expect(result.warnings.map((w) => w.code)).toContain(
            'CODE_HIGHLIGHT_FAILED',
        );
        // The good line kept its colour; the bad line fell back to default.
        const texts = codeTexts(ops);
        expect(texts.some((t) => t.color === redColor)).toBe(true);
        expect(
            texts
                .filter((t) => (t.text as string).includes('bad'))
                .every((t) => t.color === '#000000'),
        ).toBe(true);
        // No text was lost or invented.
        expect(texts.map((t) => t.text as string).join('')).toContain(
            'ok linebad line',
        );
    });

    it('receives the code with tabs expanded and the fence language', async () => {
        const seen: Array<{ code: string; lang?: string }> = [];
        const { doc } = recordDoc();
        await MdTextRender(doc, '```ts\n\tindented\n```', {
            ...MINIMAL,
            codeBlock: {
                highlight: (code, lang) => {
                    seen.push({ code, lang });
                    return code.split('\n').map((line) => [{ text: line }]);
                },
            },
        });

        expect(seen).toHaveLength(1);
        expect(seen[0].code).toBe('    indented');
        expect(seen[0].lang).toBe('ts');
    });
});
