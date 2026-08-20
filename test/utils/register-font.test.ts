import { describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { registerFont } from '../../src/index';
import type { RegisterFontOptions } from '../../src/utils/register-font';

/**
 * Item 7 — the font registration helper.
 *
 * Using a non-core font otherwise means driving addFileToVFS and addFont by
 * hand and getting the style names to line up with what the renderer asks for.
 * The renderer calls `setFont(family, style)` with exactly 'normal', 'bold',
 * 'italic' and 'bolditalic'; a mismatch silently falls back to a core font in
 * another family rather than failing, which is a hard problem to spot in a PDF.
 */

/** Records the VFS/addFont wiring without invoking jsPDF's TTF parser. */
const spyDoc = () => {
    const vfs: Array<{ name: string; data: string }> = [];
    const fonts: Array<{ file: string; family: string; style: string }> = [];
    const doc = {
        addFileToVFS: (name: string, data: string) => vfs.push({ name, data }),
        addFont: (file: string, family: string, style: string) =>
            fonts.push({ file, family, style }),
    } as unknown as jsPDF;
    return { doc, vfs, fonts };
};

const B64 = Buffer.from('font-bytes').toString('base64');
const silentOpts = (o: Partial<RegisterFontOptions>) =>
    ({ onWarning: () => {}, ...o }) as RegisterFontOptions;

describe('registerFont wiring', () => {
    it('registers each variant under the style name the renderer selects', () => {
        const { doc, vfs, fonts } = spyDoc();

        registerFont(
            doc,
            silentOpts({
                family: 'Inter',
                variants: {
                    normal: B64,
                    bold: B64,
                    italic: B64,
                    bolditalic: B64,
                },
            }),
        );

        // These four style names are exactly what applyStyleToDoc asks for.
        expect(fonts.map((f) => f.style)).toEqual([
            'normal',
            'bold',
            'italic',
            'bolditalic',
        ]);
        expect(fonts.every((f) => f.family === 'Inter')).toBe(true);
        // Every registered font has matching VFS data.
        expect(vfs.map((v) => v.name)).toEqual(fonts.map((f) => f.file));
    });

    it('returns a font config that drops straight into RenderOption', () => {
        const { doc } = spyDoc();
        const result = registerFont(
            doc,
            silentOpts({
                family: 'Inter',
                variants: { normal: B64, bold: B64, italic: B64, bolditalic: B64 },
            }),
        );

        expect(result.font).toEqual({
            regular: { name: 'Inter', style: 'normal' },
            bold: { name: 'Inter', style: 'bold' },
            italic: { name: 'Inter', style: 'italic' },
            boldItalic: { name: 'Inter', style: 'bolditalic' },
        });
        expect(result.registered).toEqual([
            'normal',
            'bold',
            'italic',
            'bolditalic',
        ]);
    });

    it('accepts a data: URI as well as raw base64', () => {
        const { doc, vfs } = spyDoc();
        registerFont(
            doc,
            silentOpts({
                family: 'Inter',
                variants: { normal: `data:font/ttf;base64,${B64}` },
            }),
        );
        expect(vfs[0].data).toBe(B64);
    });

    it('honours explicit VFS file names', () => {
        const { doc, fonts } = spyDoc();
        registerFont(
            doc,
            silentOpts({
                family: 'Inter',
                variants: { normal: B64, bold: B64 },
                fileNames: { normal: 'custom-regular.ttf' },
            }),
        );
        expect(fonts[0].file).toBe('custom-regular.ttf');
        // Unspecified names still get a sensible default.
        expect(fonts[1].file).toBe('Inter-bold.ttf');
    });
});

describe('missing variants', () => {
    it('falls back to the normal face rather than an unregistered style', () => {
        const { doc } = spyDoc();
        const result = registerFont(
            doc,
            silentOpts({ family: 'Inter', variants: { normal: B64 } }),
        );

        // Selecting 'bold' on a family with no bold face would make jsPDF
        // substitute a core font in a different family.
        expect(result.font.bold).toEqual({ name: 'Inter', style: 'normal' });
        expect(result.font.italic.style).toBe('normal');
        expect(result.font.boldItalic.style).toBe('normal');
        expect(result.registered).toEqual(['normal']);
    });

    it('warns once, listing every missing style', () => {
        const { doc } = spyDoc();
        const messages: string[] = [];

        registerFont(doc, {
            family: 'Inter',
            variants: { normal: B64 },
            onWarning: (m) => messages.push(m),
        });

        expect(messages).toHaveLength(1);
        expect(messages[0]).toContain("'bold'");
        expect(messages[0]).toContain("'italic'");
        expect(messages[0]).toContain("'bolditalic'");
    });

    it('does not warn when every variant is supplied', () => {
        const { doc } = spyDoc();
        const messages: string[] = [];

        registerFont(doc, {
            family: 'Inter',
            variants: { normal: B64, bold: B64, italic: B64, bolditalic: B64 },
            onWarning: (m) => messages.push(m),
        });

        expect(messages).toEqual([]);
    });

    it('falls back and reports when a variant fails to register', () => {
        const messages: string[] = [];
        const doc = {
            addFileToVFS: () => {},
            addFont: (_f: string, _fam: string, style: string) => {
                if (style === 'bold') throw new Error('bad font data');
            },
        } as unknown as jsPDF;

        const result = registerFont(doc, {
            family: 'Inter',
            variants: { normal: B64, bold: B64, italic: B64, bolditalic: B64 },
            onWarning: (m) => messages.push(m),
        });

        expect(result.registered).not.toContain('bold');
        expect(result.font.bold.style).toBe('normal');
        expect(messages.join(' ')).toContain('bad font data');
    });

    it('logs to the console when no onWarning is given', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { doc } = spyDoc();
        registerFont(doc, { family: 'Inter', variants: { normal: B64 } });
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe('input validation', () => {
    it('rejects a missing family', () => {
        const { doc } = spyDoc();
        expect(() =>
            registerFont(doc, {
                family: '  ',
                variants: { normal: B64 },
            }),
        ).toThrowError(/family is required/);
    });

    it('rejects a missing normal variant, since everything falls back to it', () => {
        const { doc } = spyDoc();
        expect(() =>
            registerFont(doc, {
                family: 'Inter',
                variants: {} as never,
            }),
        ).toThrowError(/variants.normal is required/);
    });

    it('rejects a jsPDF build without font registration support', () => {
        expect(() =>
            registerFont({} as jsPDF, {
                family: 'Inter',
                variants: { normal: B64 },
            }),
        ).toThrowError(/addFileToVFS\/addFont/);
    });
});

describe('against a real jsPDF document', () => {
    it('adds the family to the document font list', () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        registerFont(
            doc,
            silentOpts({
                family: 'ProbeFamily',
                variants: { normal: B64, bold: B64 },
            }),
        );

        const list = (
            doc as unknown as { getFontList: () => Record<string, string[]> }
        ).getFontList();
        expect(Object.keys(list)).toContain('ProbeFamily');
        expect(list.ProbeFamily).toEqual(
            expect.arrayContaining(['normal', 'bold']),
        );
    });

    it('makes setFont select the registered family and style', () => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const result = registerFont(
            doc,
            silentOpts({
                family: 'ProbeFamily',
                variants: { normal: B64, bold: B64 },
            }),
        );

        doc.setFont(result.font.bold.name, result.font.bold.style);
        const active = doc.getFont();
        expect(active.fontName).toBe('ProbeFamily');
        expect(active.fontStyle).toBe('bold');
    });
});

describe('malformed font data', () => {
    it('detects a face jsPDF rejected without throwing', () => {
        // jsPDF reports a bad font through its own event channel rather than by
        // throwing, so registration can look successful while leaving nothing
        // usable behind. Synthetic bytes are exactly that case.
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const messages: string[] = [];

        const result = registerFont(doc, {
            family: 'BrokenFamily',
            variants: { normal: B64, bold: B64 },
            onWarning: (m) => messages.push(m),
        });

        const list = (
            doc as unknown as { getFontList: () => Record<string, string[]> }
        ).getFontList();

        // Whatever jsPDF actually accepted is what we report as registered.
        for (const style of result.registered) {
            expect(list.BrokenFamily ?? []).toContain(style);
        }
        // Anything it rejected falls back rather than selecting a broken face.
        for (const style of ['bold', 'italic', 'bolditalic'] as const) {
            if (!result.registered.includes(style)) {
                const key = style === 'bolditalic' ? 'boldItalic' : style;
                expect(
                    result.font[key as 'bold' | 'italic' | 'boldItalic'].style,
                ).toBe('normal');
            }
        }
    });
});
