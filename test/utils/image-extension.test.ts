import { describe, expect, it } from 'vitest';
import {
    parseImageAttrsFromHref,
    preprocessImageAttributes,
} from '../../src/parser/imageExtension';
import { RenderWarnings } from '../../src/store/renderWarnings';

describe('imageExtension parser hardening', () => {
    it('parses valid width/height/align attributes', () => {
        const input = '![alt](https://img.test/a.png){width=200 height=150 align=center}';
        const processed = preprocessImageAttributes(input);
        const href = processed.match(/\(([^)]+)\)/)?.[1] ?? '';
        const parsed = parseImageAttrsFromHref(href);

        expect(parsed.cleanHref).toBe('https://img.test/a.png');
        expect(parsed.attrs.width).toBe(200);
        expect(parsed.attrs.height).toBe(150);
        expect(parsed.attrs.align).toBe('center');
    });

    it('skips oversized attribute blocks without hanging', () => {
        const warnings = new RenderWarnings({ logToConsole: false });
        const longAttrs = `width=200 ${'k='.repeat(400)}`;
        const input = `![alt](https://img.test/a.png){${longAttrs}}`;

        const started = Date.now();
        const processed = preprocessImageAttributes(input, warnings);
        const elapsed = Date.now() - started;

        expect(elapsed).toBeLessThan(100);
        expect(processed).toContain('https://img.test/a.png');
        expect(processed).not.toContain('__jmr_');

        // The image still renders, so the dropped sizing must be reported or
        // the only symptom is a picture at the wrong size.
        const reported = warnings.list();
        expect(reported).toHaveLength(1);
        expect(reported[0].code).toBe('IMAGE_ATTRS_IGNORED');
    });

    it('reports ignored attributes on the render result', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const longAttrs = `width=200 ${'k='.repeat(400)}`;

        const result = await MdTextRender(
            doc,
            `![alt](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==){${longAttrs}}`,
            {
                page: { margin: { top: 10, right: 10, bottom: 10, left: 10 } },
                font: { regular: { name: 'helvetica', style: 'normal' } },
                silent: true,
            },
        );

        expect(
            result.warnings.some((w) => w.code === 'IMAGE_ATTRS_IGNORED'),
        ).toBe(true);
    });
});
