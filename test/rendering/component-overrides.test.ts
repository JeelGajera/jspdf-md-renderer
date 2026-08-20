import { describe, expect, it } from 'vitest';
import { MdTextRender } from '../../src/index';
import type {
    ComponentContext,
    ComponentName,
} from '../../src/types/components';
import { goldenOptions, recordDoc } from '../golden/recorder';

/**
 * Item 5 — the component override API.
 *
 * The highest-leverage item on the roadmap: it lets callers solve their own
 * edge cases without waiting for a release, and removes the need for the
 * library to grow an option for every conceivable visual tweak.
 *
 * Hook signatures are permanent API surface, so these tests pin the contract:
 * what the context carries, what `next()` guarantees, and what happens when an
 * override misbehaves.
 */

const silent = (over = {}) => goldenOptions({ silent: true, ...over });

const textOps = (ops: ReturnType<typeof recordDoc>['ops']) =>
    ops.filter((o) => o.op === 'text');

const ALL_COMPONENTS: ComponentName[] = [
    'heading',
    'paragraph',
    'list',
    'listItem',
    'blockquote',
    'code',
    'table',
    'image',
    'hr',
];

const DOC_EXERCISING_EVERY_COMPONENT = [
    '# Heading',
    '',
    'A paragraph.',
    '',
    '- item one',
    '- item two',
    '',
    '> quoted',
    '',
    '```js',
    'const a = 1;',
    '```',
    '',
    '| A | B |',
    '|---|---|',
    '| 1 | 2 |',
    '',
    '---',
    '',
    '![alt](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==)',
].join('\n');

describe('override dispatch', () => {
    it('invokes an override instead of the built-in renderer', async () => {
        const { doc, ops } = recordDoc();
        let called = 0;

        await MdTextRender(
            doc,
            '# Original heading\n\nBody.',
            silent({
                components: {
                    heading: (ctx: ComponentContext) => {
                        called++;
                        ctx.doc.text('REPLACED', ctx.x, ctx.y, {
                            baseline: 'top',
                        });
                        ctx.store.updateY(10, 'add');
                    },
                },
            }),
        );

        expect(called).toBe(1);
        const drawn = textOps(ops).map((o) => o.text);
        expect(drawn).toContain('REPLACED');
        expect(drawn).not.toContain('Original');
    });

    it('reaches every documented component', async () => {
        const seen = new Set<ComponentName>();
        const components = Object.fromEntries(
            ALL_COMPONENTS.map((name) => [
                name,
                (ctx: ComponentContext) => {
                    seen.add(name);
                    ctx.next();
                },
            ]),
        );

        const { doc } = recordDoc();
        await MdTextRender(
            doc,
            DOC_EXERCISING_EVERY_COMPONENT,
            silent({ components }),
        );

        for (const name of ALL_COMPONENTS) {
            expect(seen, `${name} override was never invoked`).toContain(name);
        }
    });
});

describe('ctx.next()', () => {
    it('runs the built-in so an override can decorate rather than replace', async () => {
        const { doc, ops } = recordDoc();

        await MdTextRender(
            doc,
            '# Decorated',
            silent({
                components: {
                    heading: (ctx: ComponentContext) => {
                        ctx.doc.setFillColor('#EEEEFF');
                        ctx.doc.rect(ctx.x, ctx.y, ctx.maxWidth, 8, 'F');
                        ctx.next();
                    },
                },
            }),
        );

        // Both the decoration and the original heading are present.
        expect(ops.some((o) => o.op === 'rect')).toBe(true);
        expect(textOps(ops).map((o) => o.text)).toContain('Decorated');
    });

    it('is a no-op after the first call, so a block cannot be drawn twice', async () => {
        const { doc, ops } = recordDoc();

        await MdTextRender(
            doc,
            '# Once',
            silent({
                components: {
                    heading: (ctx: ComponentContext) => {
                        ctx.next();
                        ctx.next();
                        ctx.next();
                    },
                },
            }),
        );

        expect(
            textOps(ops).filter((o) => o.text === 'Once'),
        ).toHaveLength(1);
    });
});

describe('context contents', () => {
    it('carries geometry the override would otherwise have to recompute', async () => {
        const { doc } = recordDoc();
        let captured: ComponentContext | undefined;

        await MdTextRender(
            doc,
            '> - nested item',
            silent({
                components: {
                    listItem: (ctx: ComponentContext) => {
                        captured ??= ctx;
                        ctx.next();
                    },
                },
            }),
        );

        expect(captured).toBeDefined();
        const ctx = captured!;
        expect(ctx.indentLevel).toBeGreaterThan(0);
        expect(ctx.indent).toBe(ctx.indentLevel * ctx.options.page.indent);
        expect(ctx.maxWidth).toBe(
            ctx.options.page.maxContentWidth - ctx.indent,
        );
        expect(ctx.element.type).toBe('list_item');
        expect(typeof ctx.next).toBe('function');
        expect(typeof ctx.render).toBe('function');
    });

    it('lets an override lay out children through ctx.render', async () => {
        const { doc, ops } = recordDoc();

        await MdTextRender(
            doc,
            '> quoted body',
            silent({
                components: {
                    blockquote: (ctx: ComponentContext) => {
                        // Render the children directly, skipping the bar.
                        for (const child of ctx.element.items ?? []) {
                            ctx.render(child, ctx.indentLevel);
                        }
                    },
                },
            }),
        );

        expect(textOps(ops).map((o) => o.text)).toContain('quoted');
        // The built-in would have drawn the quote bar; this override did not.
        expect(ops.some((o) => o.op === 'line')).toBe(false);
    });

    it('routes nested elements through overrides via ctx.render', async () => {
        const { doc } = recordDoc();
        let paragraphs = 0;

        await MdTextRender(
            doc,
            '> quoted body',
            silent({
                components: {
                    blockquote: (ctx: ComponentContext) => {
                        for (const child of ctx.element.items ?? []) {
                            ctx.render(child, ctx.indentLevel);
                        }
                    },
                    paragraph: (ctx: ComponentContext) => {
                        paragraphs++;
                        ctx.next();
                    },
                },
            }),
        );

        expect(paragraphs).toBeGreaterThan(0);
    });
});

describe('a misbehaving override degrades safely', () => {
    it('falls back to the built-in when the override throws', async () => {
        const { doc, ops } = recordDoc();

        const result = await MdTextRender(
            doc,
            '# Still here',
            silent({
                components: {
                    heading: () => {
                        throw new Error('override exploded');
                    },
                },
            }),
        );

        // The block is not lost.
        expect(textOps(ops).map((o) => o.text)).toContain('Still');
        // And the failure is reported rather than swallowed.
        const failures = result.warnings.filter(
            (w) => w.code === 'COMPONENT_OVERRIDE_FAILED',
        );
        expect(failures).toHaveLength(1);
        expect(failures[0].context).toBe('heading');
        expect(failures[0].message).toContain('override exploded');
    });

    it('does not double-draw when the override throws after calling next', async () => {
        const { doc, ops } = recordDoc();

        const result = await MdTextRender(
            doc,
            '# Once only',
            silent({
                components: {
                    heading: (ctx: ComponentContext) => {
                        ctx.next();
                        throw new Error('late failure');
                    },
                },
            }),
        );

        expect(
            textOps(ops).filter((o) => o.text === 'Once'),
        ).toHaveLength(1);
        expect(
            result.warnings.some(
                (w) => w.code === 'COMPONENT_OVERRIDE_FAILED',
            ),
        ).toBe(true);
    });

    it('keeps rendering the rest of the document after a failure', async () => {
        const { doc, ops } = recordDoc();

        await MdTextRender(
            doc,
            '# Bad heading\n\nBody survives.',
            silent({
                components: {
                    heading: () => {
                        throw new Error('nope');
                    },
                },
            }),
        );

        expect(textOps(ops).map((o) => o.text)).toContain('survives.');
    });
});

describe('overrides do not change default rendering', () => {
    it('produces identical output when components is omitted', async () => {
        const withEmpty = recordDoc();
        const without = recordDoc();

        await MdTextRender(
            withEmpty.doc,
            DOC_EXERCISING_EVERY_COMPONENT,
            silent({ components: {} }),
        );
        await MdTextRender(
            without.doc,
            DOC_EXERCISING_EVERY_COMPONENT,
            silent(),
        );

        expect(withEmpty.transcript()).toBe(without.transcript());
    });

    it('produces identical output when every override just calls next', async () => {
        const passthrough = recordDoc();
        const baseline = recordDoc();

        const components = Object.fromEntries(
            ALL_COMPONENTS.map((name) => [
                name,
                (ctx: ComponentContext) => ctx.next(),
            ]),
        );

        await MdTextRender(
            passthrough.doc,
            DOC_EXERCISING_EVERY_COMPONENT,
            silent({ components }),
        );
        await MdTextRender(
            baseline.doc,
            DOC_EXERCISING_EVERY_COMPONENT,
            silent(),
        );

        expect(passthrough.transcript()).toBe(baseline.transcript());
    });
});
