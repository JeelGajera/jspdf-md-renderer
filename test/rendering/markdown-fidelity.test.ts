import { describe, expect, it, vi } from 'vitest';
import { MdTextRender, MdTextParser } from '../../src/index';
import { goldenOptions, recordDoc } from '../golden/recorder';
import { enforceNestedDepthAndImageCount } from '../../src/security/security-guards';
import { normalizeSecurityOptions } from '../../src/security/security-policy';
import { RenderWarnings } from '../../src/store/renderWarnings';
import type { ParsedElement } from '../../src/types/parsedElement';

const drawnText = (ops: ReturnType<typeof recordDoc>['ops']): string[] =>
    ops.filter((o) => o.op === 'text').map((o) => String(o.text));

describe('markdown fidelity (D10, D11)', () => {
    it('renders escaped characters without the backslash', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            'An escaped \\* asterisk and \\_underscore\\_.',
            goldenOptions(),
        );
        const text = drawnText(ops);
        expect(text).toContain('*');
        expect(text).toContain('_');
        expect(text.some((t) => t.includes('\\'))).toBe(false);
    });

    it('renders strikethrough text without the tildes and draws a rule', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, 'Some ~~removed~~ text.', goldenOptions());

        const text = drawnText(ops);
        expect(text).toContain('removed');
        expect(text.some((t) => t.includes('~~'))).toBe(false);

        // A rule is drawn across the struck word.
        expect(ops.some((o) => o.op === 'line')).toBe(true);
    });

    it('does not print link reference definitions', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            'See [the docs][ref].\n\n[ref]: https://example.com\n',
            goldenOptions(),
        );
        const text = drawnText(ops).join(' ');
        expect(text).not.toContain('[ref]:');
        expect(text).not.toContain('https://example.com');
        // The link itself still resolves.
        expect(
            ops.some(
                (o) => o.op === 'link' && o.url === 'https://example.com',
            ),
        ).toBe(true);
    });

    it('does not leak HTML comments containing a greater-than sign', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            'Before.\n\n<!-- a comment with > inside -->\n\nAfter.',
            goldenOptions(),
        );
        const text = drawnText(ops).join(' ');
        expect(text).toContain('Before.');
        expect(text).toContain('After.');
        expect(text).not.toContain('-->');
        expect(text).not.toContain('inside');
    });

    it('keeps a sentence with inline HTML tags on one line', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            'Text with <strong>bold html</strong> here.',
            goldenOptions(),
        );
        const ys = new Set(
            ops.filter((o) => o.op === 'text').map((o) => Number(o.y)),
        );
        expect(ys.size).toBe(1);
    });
});

describe('list items with block content (D2)', () => {
    it('renders a fenced code block nested in a list item', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            '- item with code\n\n  ```js\n  const a = 1;\n  ```\n\n- next item',
            goldenOptions(),
        );

        const text = drawnText(ops);
        expect(text).toContain('const a = 1;');
        // The code block's background box is drawn.
        expect(ops.some((o) => o.op === 'roundedRect')).toBe(true);
    });

    it('indents the nested block inside the item rather than at the margin', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            '- item\n\n  ```js\n  const a = 1;\n  ```\n',
            goldenOptions(),
        );
        const box = ops.find((o) => o.op === 'roundedRect');
        expect(box).toBeDefined();
        expect(Number(box!.x)).toBeGreaterThan(goldenOptions().page.xpading);
    });

    it('still renders a plain list unchanged', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, '- one\n- two\n', goldenOptions());
        expect(drawnText(ops)).toEqual(['• ', 'one', '• ', 'two']);
    });
});

describe('code block language label (D8)', () => {
    it('places the label on its own row above the code', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, '```js\nconst a = 1;\n```', goldenOptions());

        const label = ops.find((o) => o.op === 'text' && o.text === 'js');
        const code = ops.find(
            (o) => o.op === 'text' && o.text === 'const a = 1;',
        );
        expect(label).toBeDefined();
        expect(code).toBeDefined();
        expect(Number(code!.y)).toBeGreaterThan(Number(label!.y));
    });

    it('keeps the label inside the block box', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, '```js\nconst a = 1;\n```', goldenOptions());

        const box = ops.find((o) => o.op === 'roundedRect')!;
        const label = ops.find((o) => o.op === 'text' && o.text === 'js')!;
        expect(Number(label.x)).toBeGreaterThanOrEqual(Number(box.x));
        expect(Number(label.x)).toBeLessThanOrEqual(
            Number(box.x) + Number(box.w),
        );
    });
});

describe('horizontal rule width (D12)', () => {
    it('spans the content column, not the physical page', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            'Above.\n\n---\n\nBelow.',
            goldenOptions({
                page: { ...goldenOptions().page, maxContentWidth: 100 },
            }),
        );

        const rule = ops.find((o) => o.op === 'line')!;
        expect(Number(rule.x1)).toBe(10);
        expect(Number(rule.x2)).toBe(110);
    });
});

describe('table fidelity (D13)', () => {
    it('renders cell text without its markdown markup', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            '| A | B |\n|---|---|\n| **bold** | [label](https://e.com) |\n',
            goldenOptions(),
        );
        const text = drawnText(ops);
        expect(text).toContain('bold');
        expect(text).toContain('label');
        expect(text.some((t) => t.includes('**'))).toBe(false);
        expect(text.some((t) => t.includes(']('))).toBe(false);
    });

    it('parses column alignment from the delimiter row', async () => {
        const parsed = await MdTextParser(
            '| A | B | C |\n|:--|:-:|--:|\n| 1 | 2 | 3 |\n',
        );
        expect(parsed[0].columnAlign).toEqual(['left', 'center', 'right']);
    });

    it('right-aligns a right-aligned column', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(
            doc,
            '| A | B |\n|:--|--:|\n| left | right |\n',
            goldenOptions(),
        );
        const left = ops.find((o) => o.op === 'text' && o.text === 'left')!;
        const right = ops.find((o) => o.op === 'text' && o.text === 'right')!;
        // The right-aligned cell sits far past the midpoint of the table.
        expect(Number(right.x)).toBeGreaterThan(Number(left.x) + 100);
    });
});

describe('unloadable images fall back to alt text (D14)', () => {
    it('renders the alt text when the image cannot be loaded', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { doc, ops } = recordDoc();

        await MdTextRender(
            doc,
            '![Company logo](http://127.0.0.1:1/missing.png)\n\nAfter.',
            goldenOptions(),
        );

        const text = drawnText(ops).join(' ');
        expect(text).toContain('Company');
        expect(text).toContain('logo');
        expect(text).toContain('After.');
        warn.mockRestore();
    });

    it('drops the image entirely when there is no alt text', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { doc, ops } = recordDoc();

        await MdTextRender(
            doc,
            '![](http://127.0.0.1:1/missing.png)\n\nAfter.',
            goldenOptions(),
        );

        expect(drawnText(ops)).toEqual(['After.']);
        warn.mockRestore();
    });
});

describe('page decorations are scoped to this render (D16)', () => {
    it('does not re-stamp pages decorated by an earlier render', async () => {
        const { doc, ops } = recordDoc();
        const options = goldenOptions({
            footer: { showPageNumbers: true, align: 'right' },
        });

        await MdTextRender(doc, 'First render.', options);
        doc.addPage();
        await MdTextRender(doc, 'Second render.', options);

        const footersOnPage1 = ops.filter(
            (o) =>
                o.op === 'text' &&
                o.page === 1 &&
                String(o.text).startsWith('Page'),
        );
        expect(footersOnPage1).toHaveLength(1);
    });
});

describe('maxNestedDepth counts markdown nesting (D7)', () => {
    const structuralDepth = async (levels: number): Promise<ParsedElement[]> => {
        let md = '';
        for (let i = 0; i < levels; i++) {
            md += '  '.repeat(i) + `- level ${i}\n`;
        }
        return MdTextParser(md);
    };

    it('allows a list nested close to the configured limit', async () => {
        const elements = await structuralDepth(8);
        const security = normalizeSecurityOptions({
            enabled: true,
            maxNestedDepth: 20,
            violationMode: 'skip',
        });

        const violations: string[] = [];
        enforceNestedDepthAndImageCount(elements, {
            ...security,
            onSecurityViolation: (v) => violations.push(v.code),
        });

        expect(violations).not.toContain('MAX_NESTED_DEPTH_EXCEEDED');
        // The deepest item survives.
        const json = JSON.stringify(elements);
        expect(json).toContain('level 7');
    });

    it('reports how much content a depth violation dropped', async () => {
        const elements = await structuralDepth(10);
        const security = normalizeSecurityOptions({
            enabled: true,
            maxNestedDepth: 3,
            violationMode: 'skip',
        });

        const violations: string[] = [];
        const warnings = new RenderWarnings({ logToConsole: false });
        enforceNestedDepthAndImageCount(
            elements,
            {
                ...security,
                onSecurityViolation: (v) => violations.push(v.code),
            },
            warnings,
        );

        expect(violations).toContain('MAX_NESTED_DEPTH_EXCEEDED');
        // Reported once, not once per branch.
        expect(
            violations.filter((v) => v === 'MAX_NESTED_DEPTH_EXCEEDED'),
        ).toHaveLength(1);

        // The dropped content is quantified, not just flagged.
        const dropped = warnings
            .list()
            .filter((w) => w.code === 'CONTENT_DROPPED');
        expect(dropped).toHaveLength(1);
        expect(dropped[0].droppedNodes).toBeGreaterThan(0);
        expect(warnings.droppedNodes).toBe(dropped[0].droppedNodes);
    });
});
