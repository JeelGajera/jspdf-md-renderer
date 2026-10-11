import { describe, expect, it, vi } from 'vitest';

describe('link.underline option', () => {
    it('renders links without underline by default', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');

        await MdTextRender(doc, '[example](https://example.com)', {
            font: { regular: { name: 'helvetica', style: 'normal' } },
            logToConsole: false,
        });

        // No underline drawn by default
        expect(lineSpy).not.toHaveBeenCalled();
    });

    it('draws an underline under link text when link.underline is true', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');

        await MdTextRender(doc, '[example](https://example.com)', {
            font: { regular: { name: 'helvetica', style: 'normal' } },
            link: { underline: true },
            logToConsole: false,
        });

        // Underline drawn once for the single link word
        expect(lineSpy).toHaveBeenCalledTimes(1);
        const [x1, y1, x2, y2] = lineSpy.mock.calls[0];
        expect(x2).toBeGreaterThan(x1); // horizontal line spanning the word
        expect(y2).toBe(y1); // horizontal
    });

    it('accepts link.underline without linkColor (linkColor is optional)', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });

        // Type-level: linkColor no longer required; runtime: falls back to blue
        const result = await MdTextRender(doc, '[example](https://example.com)', {
            font: { regular: { name: 'helvetica', style: 'normal' } },
            link: { underline: true },
            logToConsole: false,
        });

        expect(result.warnings).toHaveLength(0);
    });

    it('underlines every word of a multi-word link', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const lineSpy = vi.spyOn(doc, 'line');

        await MdTextRender(doc, '[click here now](https://example.com)', {
            font: { regular: { name: 'helvetica', style: 'normal' } },
            link: { underline: true },
            logToConsole: false,
        });

        expect(lineSpy).toHaveBeenCalledTimes(3);
    });
});
