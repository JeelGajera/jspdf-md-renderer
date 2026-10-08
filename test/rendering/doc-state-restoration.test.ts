import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import { createRenderOptions } from '../helpers/renderOptions';

/**
 * Issue #75 — rendering left the document's fill color, draw color and line
 * width at whatever the last block set, so anything the caller drew afterwards
 * (a signature box, a stamp, a footer line) silently inherited them.
 */
describe('doc state restoration (issue #75)', () => {
    it('restores fill color, draw color and line width after rendering', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        doc.setFillColor('#ff0000');
        doc.setDrawColor('#00ff00');
        doc.setLineWidth(1.5);

        await MdTextRender(
            doc,
            [
                '- [x] done',
                '',
                'Some `code`',
                '',
                '> A quote',
                '',
                '---',
                '',
                '| a | b |',
                '|---|---|',
                '| 1 | 2 |',
                '',
                '```ts',
                'const x = 1;',
                '```',
            ].join('\n'),
            createRenderOptions({ silent: true }),
        );

        expect(doc.getFillColor()).toBe('#ff0000');
        expect(doc.getDrawColor()).toBe('#00ff00');
        expect(doc.getLineWidth()).toBe(1.5);
    });
});
