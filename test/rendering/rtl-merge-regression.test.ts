import { afterEach, describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import { setWordRunMergingEnabled } from '../../src/layout/lineRenderer';
import { goldenOptions } from '../golden/recorder';

/**
 * Review follow-up on issue #111: with doc.setR2L(true), jsPDF reverses the
 * entire string of a single text() call, so a merged "foo bar baz" run
 * would be emitted as one (zab rab oof) Tj at the first word's x — word
 * order and glyph positions change even though the width guard passes.
 * Merging must stay off while the document's RTL setting is active, so the
 * real PDF keeps master's three positioned strings (oof), (rab), (zab).
 *
 * Courier regular is used because its jsPDF widths match the viewer AFM
 * widths, so the per-word guard would otherwise let the run merge.
 */

const COURIER = goldenOptions({
    font: { regular: { name: 'courier', style: 'normal' } },
});

/** The literal strings jsPDF emits with Tj, in content-stream order. */
const tjStrings = (pdfLatin1: string): string[] => {
    const out: string[] = [];
    for (const m of pdfLatin1.matchAll(/\(((?:\\.|[^()\\])*)\) Tj/g)) {
        out.push(m[1]);
    }
    return out;
};

const renderRtlPdf = async (
    markdown: string,
    mergeRuns: boolean,
): Promise<string> => {
    setWordRunMergingEnabled(mergeRuns);
    try {
        const doc = new jsPDF({
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
        });
        doc.setR2L(true);
        await MdTextRender(doc, markdown, COURIER);
        return Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString(
            'latin1',
        );
    } finally {
        setWordRunMergingEnabled(true);
    }
};

describe('RTL word-run merging (issue #111 follow-up)', () => {
    afterEach(() => {
        setWordRunMergingEnabled(true);
    });

    it('keeps master\u2019s per-word strings under setR2L(true)', async () => {
        const pdf = await renderRtlPdf('foo bar baz', true);
        const strings = tjStrings(pdf);

        expect(strings).toContain('oof');
        expect(strings).toContain('rab');
        expect(strings).toContain('zab');
        expect(strings).not.toContain('zab rab oof');
    });

    it('emits byte-identical text strings to the pre-PR per-word path', async () => {
        const merged = tjStrings(await renderRtlPdf('foo bar baz', true));
        const perWord = tjStrings(await renderRtlPdf('foo bar baz', false));

        expect(merged).toEqual(perWord);
    });
});
