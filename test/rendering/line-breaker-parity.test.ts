import { describe, expect, it } from 'vitest';
import { breakIntoLines } from '../../src/layout/lineBreaker';
import { RenderStore } from '../../src/store/renderStore';
import { StyledWordInfo } from '../../src/types/styledWordInfo';
import { createRenderOptions } from '../helpers/renderOptions';
import { MockDoc } from '../helpers/mockDoc';

// MockDoc measures every char as width 2 with no char spacing.
const widthOf = (text: string): number => text.length * 2;

// Faithful reimplementation of the pre-#90 char-by-char split, used as the
// break-point oracle: the optimized splitter must land breaks in exactly the
// same places.
const oldSplit = (text: string, maxWidth: number): string[] => {
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
        let chunk = '';
        for (const ch of remaining) {
            const candidate = chunk + ch;
            const candidateWidth = widthOf(candidate);
            if (candidateWidth > maxWidth && chunk.length > 0) break;
            chunk = candidate;
            if (candidateWidth >= maxWidth) break;
        }
        if (!chunk) {
            chunk = remaining.charAt(0);
        }
        chunks.push(chunk);
        remaining = remaining.slice(chunk.length);
    }
    return chunks;
};

const splitChunks = (text: string, maxWidth: number): string[] => {
    const doc = new MockDoc();
    const store = new RenderStore(createRenderOptions());
    const word: StyledWordInfo = {
        text,
        width: widthOf(text),
        style: 'normal',
        hasTrailingSpace: false,
    };
    const lines = breakIntoLines(doc as never, [word], maxWidth, store);
    return lines.flatMap((line) => line.words.map((w) => w.text));
};

describe('splitOversizedWord (#90)', () => {
    it('lands breaks exactly where the old char-by-char walk did', () => {
        const cases: Array<[string, number]> = [
            ['abcdefghij', 20], // exact fit: one chunk
            ['abcdefghij', 19], // one char short of exact fit
            ['abcdefghij', 21], // room to spare: one chunk
            ['abcdefghij', 10], // two chunks
            ['abcdefghij', 9], // uneven chunks
            ['abcdefghij', 2], // one char per chunk
            ['abcdefghij', 1], // single chars wider than maxWidth
            ['a'.repeat(37), 20],
            ['a'.repeat(100), 33],
            ['a'.repeat(1000), 199],
            ['abc'.repeat(50), 40],
        ];
        for (const [text, maxWidth] of cases) {
            expect(splitChunks(text, maxWidth), `${text.length}@${maxWidth}`).toEqual(
                oldSplit(text, maxWidth),
            );
        }
    });

    it('rejoins to the original text and keeps chunks within maxWidth', () => {
        const text = 'x'.repeat(500);
        const maxWidth = 60;
        const chunks = splitChunks(text, maxWidth);
        expect(chunks.join('')).toBe(text);
        for (const chunk of chunks) {
            expect(widthOf(chunk) <= maxWidth || chunk.length === 1).toBe(true);
        }
    });

    it('restores the document font after splitting', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions());
        const before = { ...doc.getFont(), size: doc.getFontSize() };
        const word: StyledWordInfo = {
            text: 'z'.repeat(100),
            width: widthOf('z'.repeat(100)),
            style: 'normal',
            hasTrailingSpace: false,
        };
        breakIntoLines(doc as never, [word], 30, store);
        expect(doc.getFont()).toEqual({
            fontName: before.fontName,
            fontStyle: before.fontStyle,
        });
        expect(doc.getFontSize()).toBe(before.size);
    });

    it('measures O(n log n) instead of O(n^2) for a very long word', () => {
        const doc = new MockDoc();
        let calls = 0;
        const orig = doc.getTextWidth.bind(doc);
        doc.getTextWidth = (text: string): number => {
            calls += 1;
            return orig(text);
        };
        const store = new RenderStore(createRenderOptions());
        const text = 'w'.repeat(20000);
        const word: StyledWordInfo = {
            text,
            width: widthOf(text),
            style: 'normal',
            hasTrailingSpace: false,
        };
        const lines = breakIntoLines(doc as never, [word], 10000, store);
        expect(lines.flatMap((l) => l.words.map((w) => w.text))).toEqual(
            oldSplit(text, 10000),
        );
        // The old walk needed ~20k probes here; binary search needs < 100.
        expect(calls).toBeLessThan(2000);
    });
});
