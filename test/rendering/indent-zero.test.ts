import { describe, expect, it } from 'vitest';
import jsPDF from 'jspdf';
import { MdTextRender } from '../../src/renderer/MdTextRender';
import { createRenderOptions } from '../helpers/renderOptions';

// 1x1 PNG as a data URL.
const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('page.indent = 0 (issue #117)', () => {
    it('renders a lone block image instead of dropping it', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const options = createRenderOptions({ page: { indent: 0 } as never });

        const result = await MdTextRender(doc, `![alt](${PNG})`, options);

        expect(result.warnings).toHaveLength(0);
        expect(result.droppedNodes).toBe(0);
        // The image advances the cursor past the top margin.
        expect(result.endY).toBeGreaterThan(10);
        expect(doc.output()).not.toContain('NaN');
    });

    it('renders a paragraph with block-level children', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const options = createRenderOptions({ page: { indent: 0 } as never });

        const result = await MdTextRender(
            doc,
            'Some text\n\n```js\nconst x = 1;\n```\n',
            options,
        );

        expect(result.warnings).toHaveLength(0);
        expect(result.endY).toBeGreaterThan(10);
        expect(doc.output()).not.toContain('NaN');
    });

    it('renders nested blockquotes and lists without NaN geometry', async () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const options = createRenderOptions({ page: { indent: 0 } as never });

        const result = await MdTextRender(
            doc,
            '> A quote\n>\n> - nested item\n\n- top item\n',
            options,
        );

        expect(result.warnings).toHaveLength(0);
        expect(doc.output()).not.toContain('NaN');
    });
});
