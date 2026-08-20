import { describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import { goldenOptions } from '../golden/recorder';

/**
 * Regression tests for the code-block pagination loop.
 *
 * A page geometry whose usable height is smaller than a single line of code
 * used to make the loop add pages forever — it broke the page, recomputed the
 * same impossible fit, and broke again. Reproduced at 5,000+ pages and an
 * out-of-memory process kill. security.renderTimeoutMs did not help: the loop
 * is synchronous and contains no checkpoint, so the timeout was never sampled.
 */
describe('code block pagination', () => {
    it('terminates when no line can fit the usable page height', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        let pages = 0;
        const originalAddPage = doc.addPage.bind(doc);
         
        (doc as any).addPage = (...args: any[]) => {
            pages++;
            if (pages > 200) throw new Error('runaway pagination');
             
            return (originalAddPage as any)(...args);
        };

        await MdTextRender(
            doc,
            '```\nline one\nline two\nline three\n```',
            goldenOptions({
                page: { ...goldenOptions().page, maxContentHeight: 18 },
                codeBlock: { padding: 4 },
            }),
        );

        // One page per line at most, plus the page we started on.
        expect(pages).toBeLessThanOrEqual(5);
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('exceeds the usable'),
        );
        warn.mockRestore();
    });

    it('still paginates normally when lines do fit', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const code = Array.from(
            { length: 120 },
            (_, i) => `const line${i} = ${i};`,
        ).join('\n');

        await MdTextRender(
            doc,
            '```js\n' + code + '\n```',
            goldenOptions(),
        );

        const pages = (
            doc.internal as unknown as { getNumberOfPages: () => number }
        ).getNumberOfPages();
        expect(pages).toBeGreaterThan(1);
        expect(pages).toBeLessThan(6);
    });

    it('does not lose code content when a block spans a page boundary', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const drawn: string[] = [];
        const originalText = doc.text.bind(doc);
         
        (doc as any).text = (t: any, x: number, y: number, o?: any) => {
            if (typeof t === 'string') drawn.push(t);
            return originalText(t, x, y, o);
        };

        const code = Array.from(
            { length: 80 },
            (_, i) => `MARKER_${i}`,
        ).join('\n');
        await MdTextRender(doc, '```\n' + code + '\n```', goldenOptions());

        for (let i = 0; i < 80; i++) {
            expect(drawn).toContain(`MARKER_${i}`);
        }
    });
});
