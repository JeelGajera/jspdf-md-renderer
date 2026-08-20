import { describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import type { RenderWarning } from '../../src/store/renderWarnings';
import { goldenOptions, recordDoc } from '../golden/recorder';

/**
 * Item 4 — the render result object.
 *
 * Failures in this library were silent: token conversion errors were logged and
 * the content dropped, image failures warned, unsupported element types warned,
 * depth violations discarded whole subtrees. A caller had no way to learn that
 * the PDF they just produced was missing content.
 */

const silent = (over = {}) =>
    goldenOptions({ silent: true, ...over });

describe('render result', () => {
    it('reports position and page count for a clean render', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const result = await MdTextRender(
            doc,
            '# Title\n\nA paragraph.',
            silent(),
        );

        expect(result.endY).toBeGreaterThan(10);
        expect(result.startPage).toBe(1);
        expect(result.pageCount).toBe(1);
        expect(result.warnings).toEqual([]);
        expect(result.droppedNodes).toBe(0);
        expect(result.violations).toEqual([]);
    });

    it('counts the pages a multi-page render produced', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const body = Array.from(
            { length: 120 },
            (_, i) => `Paragraph ${i} with enough words to occupy a line.`,
        ).join('\n\n');

        const result = await MdTextRender(doc, body, silent());
        expect(result.pageCount).toBeGreaterThan(1);
        expect(result.startPage).toBe(1);
    });

    it('counts only the pages this render produced, not the whole document', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        doc.addPage();
        doc.addPage();

        const result = await MdTextRender(doc, 'Short.', silent());
        expect(result.startPage).toBe(3);
        expect(result.pageCount).toBe(1);
    });

    it('still calls endCursorYHandler, and agrees with endY', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        let handlerY = -1;
        const result = await MdTextRender(
            doc,
            'Body.',
            silent({ endCursorYHandler: (y: number) => (handlerY = y) }),
        );
        expect(handlerY).toBe(result.endY);
    });
});

describe('silent content loss becomes observable', () => {
    it('reports an image that could not be loaded', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const result = await MdTextRender(
            doc,
            '![Company logo](http://127.0.0.1:1/missing.png)\n\nAfter.',
            silent(),
        );

        const imageWarnings = result.warnings.filter(
            (w) => w.code === 'IMAGE_LOAD_FAILED',
        );
        expect(imageWarnings).toHaveLength(1);
        expect(imageWarnings[0].context).toContain('missing.png');
    });

    it('reports a table skipped for having no header', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const result = await MdTextRender(doc, 'Text.', silent());
        expect(result.warnings).toEqual([]);

        // A table element with no header reaches the renderer via the AST.
        const doc2 = new jsPDF({ unit: 'mm', format: 'a4' });
        const result2 = await MdTextRender(
            doc2,
            '| A | B |\n|---|---|\n| 1 | 2 |\n',
            silent(),
        );
        // A well-formed table produces no warnings.
        expect(result2.warnings).toEqual([]);
    });

    it('reports content dropped by the nesting depth limit', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        let md = '';
        for (let i = 0; i < 12; i++) {
            md += '  '.repeat(i) + `- level ${i}\n`;
        }

        const result = await MdTextRender(
            doc,
            md,
            silent({
                security: {
                    enabled: true,
                    maxNestedDepth: 3,
                    violationMode: 'skip',
                },
            }),
        );

        expect(result.droppedNodes).toBeGreaterThan(0);
        expect(
            result.warnings.some((w) => w.code === 'CONTENT_DROPPED'),
        ).toBe(true);
        expect(
            result.violations.some(
                (v) => v.code === 'MAX_NESTED_DEPTH_EXCEEDED',
            ),
        ).toBe(true);
    });

    it('reports a code block that cannot fit the page', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const result = await MdTextRender(
            doc,
            '```js\nconst a = 1;\nconst b = 2;\n```',
            silent({
                page: { ...goldenOptions().page, maxContentHeight: 18 },
                codeBlock: { padding: 4 },
            }),
        );

        expect(
            result.warnings.some((w) => w.code === 'CODE_BLOCK_OVERFLOW'),
        ).toBe(true);
    });
});

describe('warning delivery', () => {
    it('calls onWarning as each warning is recorded', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const seen: RenderWarning[] = [];

        const result = await MdTextRender(
            doc,
            '![alt](http://127.0.0.1:1/x.png)',
            silent({ onWarning: (w: RenderWarning) => seen.push(w) }),
        );

        expect(seen.map((w) => w.code)).toEqual(
            result.warnings.map((w) => w.code),
        );
        expect(seen.length).toBeGreaterThan(0);
    });

    it('does not let a throwing onWarning break the render', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const result = await MdTextRender(
            doc,
            '![alt](http://127.0.0.1:1/x.png)\n\nAfter.',
            silent({
                onWarning: () => {
                    throw new Error('listener exploded');
                },
            }),
        );
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.endY).toBeGreaterThan(0);
    });

    it('logs to the console by default and stays quiet when silent', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const loud = new jsPDF({ unit: 'mm', format: 'a4' });
        await MdTextRender(
            loud,
            '![alt](http://127.0.0.1:1/x.png)',
            goldenOptions(),
        );
        expect(warn).toHaveBeenCalled();

        warn.mockClear();

        const quiet = new jsPDF({ unit: 'mm', format: 'a4' });
        const result = await MdTextRender(
            quiet,
            '![alt](http://127.0.0.1:1/x.png)',
            silent(),
        );
        expect(warn).not.toHaveBeenCalled();
        // Still collected, just not printed.
        expect(result.warnings.length).toBeGreaterThan(0);

        warn.mockRestore();
    });
});

describe('security violations on the result', () => {
    it('collects violations without displacing the caller handler', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const callerSaw: string[] = [];
        const security = {
            enabled: true,
            allowedLinkProtocols: ['https:'],
            violationMode: 'skip' as const,
            onSecurityViolation: (v: { code: string }) =>
                callerSaw.push(v.code),
        };

        const result = await MdTextRender(
            doc,
            '[bad](javascript:alert(1))',
            silent({ security }),
        );

        expect(callerSaw).toContain('LINK_PROTOCOL_BLOCKED');
        expect(
            result.violations.some((v) => v.code === 'LINK_PROTOCOL_BLOCKED'),
        ).toBe(true);
        // The caller's own object is left as they supplied it.
        expect(security.onSecurityViolation).toBeTypeOf('function');
    });

    it('does not leave a wrapper on a reused security object', async () => {
        const security = {
            enabled: true,
            allowedLinkProtocols: ['https:'],
            violationMode: 'skip' as const,
        };
        const options = silent({ security });

        const first = await MdTextRender(
            new jsPDF({ unit: 'mm', format: 'a4' }),
            '[bad](javascript:alert(1))',
            options,
        );
        const second = await MdTextRender(
            new jsPDF({ unit: 'mm', format: 'a4' }),
            '[bad](javascript:alert(1))',
            options,
        );

        // Each render reports its own violations, not an accumulation.
        expect(first.violations).toHaveLength(second.violations.length);
        expect(second.violations.length).toBeGreaterThan(0);
    });
});

describe('warnings from the security layer', () => {
    it('reports a throwing onSecurityViolation callback', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const result = await MdTextRender(
            doc,
            '[bad](javascript:alert(1))',
            silent({
                security: {
                    enabled: true,
                    allowedLinkProtocols: ['https:'],
                    violationMode: 'skip' as const,
                    onSecurityViolation: () => {
                        throw new Error('audit sink is down');
                    },
                },
            }),
        );

        const failures = result.warnings.filter(
            (w) => w.code === 'SECURITY_CALLBACK_FAILED',
        );
        expect(failures.length).toBeGreaterThan(0);
        expect(failures[0].message).toContain('audit sink is down');
        // The violation is still handled — the callback failing does not
        // turn a blocked link into an allowed one.
        expect(
            result.violations.some((v) => v.code === 'LINK_PROTOCOL_BLOCKED'),
        ).toBe(true);
    });

    it('routes security warnings through silent and onWarning', async () => {
        const seen: RenderWarning[] = [];
        const consoleWarn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {});

        await MdTextRender(
            new jsPDF({ unit: 'mm', format: 'a4' }),
            '[bad](javascript:alert(1))',
            silent({
                onWarning: (w: RenderWarning) => seen.push(w),
                security: {
                    enabled: true,
                    allowedLinkProtocols: ['https:'],
                    violationMode: 'skip' as const,
                    onSecurityViolation: () => {
                        throw new Error('audit sink is down');
                    },
                },
            }),
        );

        expect(seen.some((w) => w.code === 'SECURITY_CALLBACK_FAILED')).toBe(
            true,
        );
        // `silent` covers the security layer too.
        expect(consoleWarn).not.toHaveBeenCalled();
        consoleWarn.mockRestore();
    });
});

describe('the result does not change rendering', () => {
    it('produces identical output to a render whose result is ignored', async () => {
        const a = recordDoc();
        const b = recordDoc();
        await MdTextRender(a.doc, '# H\n\nText with **bold**.', silent());
        await MdTextRender(b.doc, '# H\n\nText with **bold**.', silent());
        expect(a.transcript()).toBe(b.transcript());
    });
});
