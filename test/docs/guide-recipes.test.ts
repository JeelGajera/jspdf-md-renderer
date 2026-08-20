import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender, registerFont } from '../../src/index';
import type { ComponentContext } from '../../src/types/components';
import { recordDoc } from '../golden/recorder';

/**
 * The snippets in docs-site/guide are the first code most adopters run. A
 * snippet that no longer compiles — or that silently produces a warning —
 * costs more trust than a missing page would, and nothing else in the suite
 * would catch it.
 *
 * Each test here is the corresponding guide recipe, run for real. Change a
 * recipe in the docs and change it here.
 */

const A4 = () => new jsPDF({ unit: 'mm', format: 'a4' });

const MINIMAL = {
    page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
    font: { regular: { name: 'helvetica', style: 'normal' } },
    silent: true,
};

describe('guide/getting-started', () => {
    it('renders with the minimal configuration', async () => {
        const doc = A4();
        const result = await MdTextRender(
            doc,
            '# My First PDF\n\nThis PDF was generated from **Markdown**.',
            MINIMAL,
        );

        expect(result.warnings).toEqual([]);
        expect(result.pageCount).toBe(1);
        expect(result.endY).toBeGreaterThan(20);
    });
});

describe('guide/page-geometry', () => {
    it('derives the content area from the document, whatever the format', async () => {
        const margin = { top: 15, right: 15, bottom: 15, left: 15 };
        const options = {
            page: { margin },
            font: { regular: { name: 'helvetica', style: 'normal' } },
            silent: true,
        };

        const portrait = A4();
        const landscape = new jsPDF({
            unit: 'mm',
            format: 'letter',
            orientation: 'landscape',
        });

        const a = await MdTextRender(portrait, '# H\n\nBody.', options);
        const b = await MdTextRender(landscape, '# H\n\nBody.', options);

        expect(a.warnings).toEqual([]);
        expect(b.warnings).toEqual([]);
        // Letter landscape is wider, so the same text needs fewer lines and
        // ends higher up the page.
        expect(b.endY).toBeLessThanOrEqual(a.endY);
    });

    it('starts at the margin origin, and at cursor when one is given', async () => {
        const withDefault = recordDoc();
        const withCursor = recordDoc();

        await MdTextRender(withDefault.doc, 'Body.', {
            ...MINIMAL,
            page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
        });
        await MdTextRender(withCursor.doc, 'Body.', {
            ...MINIMAL,
            page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
            cursor: { x: 20, y: 55 },
        });

        const firstY = (ops: ReturnType<typeof recordDoc>['ops']) =>
            ops.find((o) => o.op === 'text')!.y as number;

        expect(firstY(withDefault.ops)).toBeCloseTo(20, 0);
        expect(firstY(withCursor.ops)).toBeCloseTo(55, 0);
    });

    it('honours explicit geometry over the derived values', async () => {
        const { doc, ops } = recordDoc();
        await MdTextRender(doc, 'Body.', {
            ...MINIMAL,
            page: {
                margin: { top: 20, right: 20, bottom: 20, left: 20 },
                xpading: 40, // deprecated, but still wins
            },
        });
        expect(ops.find((o) => o.op === 'text')!.x).toBeCloseTo(40, 0);
    });
});

describe('guide/render-result', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('refuses an incomplete document via droppedNodes', async () => {
        const doc = A4();
        const result = await MdTextRender(
            doc,
            '> '.repeat(30) + 'too deep',
            {
                ...MINIMAL,
                security: {
                    enabled: true,
                    violationMode: 'skip' as const,
                    maxNestedDepth: 3,
                },
            },
        );

        expect(result.droppedNodes).toBeGreaterThan(0);
        expect(
            result.warnings.some((w) => w.code === 'CONTENT_DROPPED'),
        ).toBe(true);
    });

    it('reports a failed image by URL on the warning context', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.reject(new Error('network is down'))),
        );

        const doc = A4();
        const result = await MdTextRender(
            doc,
            '![logo](https://cdn.example.com/logo.png)',
            MINIMAL,
        );

        const failures = result.warnings.filter(
            (w) => w.code === 'IMAGE_LOAD_FAILED',
        );
        expect(failures).toHaveLength(1);
        // The guide tells callers to read the failing URL off `context`.
        expect(failures[0].context).toBe('https://cdn.example.com/logo.png');
    });

    it('gives endY and pageCount for appending content afterwards', async () => {
        const doc = A4();
        const result = await MdTextRender(doc, '# Title\n\nBody.', MINIMAL);

        doc.setFontSize(9);
        doc.text('Generated', 20, result.endY + 8);

        expect(result.startPage).toBe(1);
        expect(result.pageCount).toBe(1);
    });
});

describe('guide/component-overrides', () => {
    const recipe = async (
        markdown: string,
        components: Record<string, (ctx: ComponentContext) => void>,
    ) => {
        const { doc, ops } = recordDoc();
        const result = await MdTextRender(doc, markdown, {
            ...MINIMAL,
            components,
        });
        expect(result.warnings).toEqual([]);
        return ops;
    };

    it('draws a dashed horizontal rule', async () => {
        const ops = await recipe('Above\n\n---\n\nBelow', {
            hr: (ctx) => {
                ctx.doc.setDrawColor('#CBD5E1');
                ctx.doc.setLineDashPattern([1, 1], 0);
                ctx.doc.line(ctx.x, ctx.y, ctx.x + ctx.maxWidth, ctx.y);
                ctx.doc.setLineDashPattern([], 0);
                ctx.store.updateY(6, 'add');
            },
        });

        expect(ops.some((o) => o.op === 'line')).toBe(true);
        // The rule advanced the cursor, so the next block sits below it.
        const texts = ops.filter((o) => o.op === 'text');
        expect((texts.at(-1)!.y as number)).toBeGreaterThan(
            texts[0].y as number,
        );
    });

    it('shades h1 behind the built-in heading', async () => {
        const ops = await recipe('# Big\n\n## Small', {
            heading: (ctx) => {
                if (ctx.element.depth === 1) {
                    ctx.doc.setFillColor('#F1F5F9');
                    ctx.doc.rect(ctx.x - 2, ctx.y - 1, ctx.maxWidth + 4, 12, 'F');
                }
                ctx.next();
            },
        });

        // One shaded box for the h1, and both headings still drawn.
        expect(ops.filter((o) => o.op === 'rect')).toHaveLength(1);
        const drawn = ops.filter((o) => o.op === 'text').map((o) => o.text);
        expect(drawn).toContain('Big');
        expect(drawn).toContain('Small');
    });

    it('suppresses images for a text-only export', async () => {
        const ops = await recipe(
            'Before\n\n![alt](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==)\n\nAfter',
            { image: () => {} },
        );

        expect(ops.some((o) => o.op === 'addImage')).toBe(false);
        expect(ops.filter((o) => o.op === 'text').map((o) => o.text)).toContain(
            'Before',
        );
    });

    it('draws a blockquote accent sized to its rendered children', async () => {
        const heights: number[] = [];
        await recipe('> one line', {
            blockquote: (ctx) => {
                const top = ctx.y;
                for (const child of ctx.element.items ?? []) {
                    ctx.render(child, ctx.indentLevel);
                }
                heights.push(ctx.store.Y - top);
                ctx.doc.setFillColor('#0EA5E9');
                ctx.doc.rect(ctx.x - 4, top, 1.2, ctx.store.Y - top, 'F');
                ctx.store.updateY(3, 'add');
            },
        });

        // The accent has a real height, which is only knowable after the
        // children have been laid out.
        expect(heights[0]).toBeGreaterThan(0);
    });

    it('underlines h2 after the built-in has drawn it', async () => {
        const ops = await recipe('## Section\n\nBody.', {
            heading: (ctx) => {
                ctx.next();
                if (ctx.element.depth === 2) {
                    const y = ctx.store.Y - 1;
                    ctx.doc.setDrawColor('#E2E8F0');
                    ctx.doc.line(ctx.x, y, ctx.x + ctx.maxWidth, y);
                    ctx.store.updateY(2, 'add');
                }
            },
        });

        const line = ops.find((o) => o.op === 'line');
        const heading = ops.find((o) => o.op === 'text');
        expect(line).toBeDefined();
        // The rule sits below the heading it belongs to.
        expect(line!.y1 as number).toBeGreaterThan(heading!.y as number);
    });

    it('renders a callout blockquote and leaves other quotes alone', async () => {
        const CALLOUTS: Record<string, string> = {
            '[!NOTE]': '#3B82F6',
            '[!WARNING]': '#F59E0B',
        };

        const ops = await recipe('> [!NOTE]\n> Heads up.\n\n> plain quote', {
            blockquote: (ctx) => {
                const first = ctx.element.items?.[0];
                const marker = Object.keys(CALLOUTS).find((k) =>
                    first?.content?.startsWith(k),
                );
                if (!marker) return ctx.next();

                ctx.doc.setFillColor(CALLOUTS[marker]);
                ctx.doc.rect(ctx.x, ctx.y, 2, 10, 'F');
                ctx.next();
            },
        });

        // Exactly one callout swatch, and both quotes still rendered.
        expect(ops.filter((o) => o.op === 'rect')).toHaveLength(1);
        expect(ops.filter((o) => o.op === 'text').map((o) => o.text)).toContain(
            'plain',
        );
    });

    it('watermarks a table behind its content', async () => {
        const ops = await recipe('| A | B |\n|---|---|\n| 1 | 2 |', {
            table: (ctx) => {
                ctx.doc.setTextColor('#F1F5F9');
                ctx.doc.setFontSize(28);
                ctx.doc.text('DRAFT', ctx.x + ctx.maxWidth / 2, ctx.y + 20, {
                    align: 'center',
                    angle: 20,
                });
                ctx.doc.setTextColor('#000000');
                ctx.next();
            },
        });

        const texts = ops.filter((o) => o.op === 'text');
        // The watermark is drawn first, so it paints behind the table.
        expect(texts[0].text).toBe('DRAFT');
    });

    it('replaces list bullets and still renders item content', async () => {
        const ops = await recipe('- one\n- two', {
            listItem: (ctx) => {
                ctx.doc.setFillColor('#10B981');
                ctx.doc.circle(ctx.x - 3, ctx.y + 1.5, 1, 'F');
                for (const child of ctx.element.items ?? []) {
                    ctx.render(child, ctx.indentLevel);
                }
            },
        });

        const drawn = ops.filter((o) => o.op === 'text').map((o) => o.text);
        expect(drawn).toContain('one');
        expect(drawn).toContain('two');
        // The default bullet character is gone.
        expect(drawn.join(' ')).not.toContain('•');
    });

    it('breaks the page from an override that draws its own block', async () => {
        const doc = A4();
        const result = await MdTextRender(doc, '```\ncode\n```', {
            ...MINIMAL,
            // Start near the bottom so the override has to break.
            cursor: { x: 20, y: 270 },
            components: {
                code: (ctx) => {
                    const height = 24;
                    if (ctx.y + height > ctx.options.page.maxContentHeight) {
                        ctx.doc.addPage();
                        ctx.store.updateY(ctx.options.page.topmargin);
                    }
                    ctx.doc.text('code', ctx.x, ctx.store.Y, {
                        baseline: 'top',
                    });
                    ctx.store.updateY(height, 'add');
                },
            },
        });

        expect(result.warnings).toEqual([]);
        expect(result.pageCount).toBe(2);
    });
});

describe('examples/custom-fonts', () => {
    it('registers a family and hands back a usable font config', () => {
        const doc = A4();
        const data = Buffer.from('font-bytes').toString('base64');

        const brand = registerFont(doc, {
            family: 'BrandSans',
            variants: { normal: data },
            onWarning: () => {},
        });

        expect(brand.font.regular.name).toBe('BrandSans');
        // Missing styles fall back rather than selecting an unregistered face.
        expect(brand.font.bold.style).toBe('normal');
    });
});
