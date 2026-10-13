// src/layout/lineBreaker.ts
import jsPDF from 'jspdf';
import { StyledWordInfo, StyledLine } from '../types/styledWordInfo';
import { RenderStore } from '../store/renderStore';
import { getCharHight } from '../utils/doc-helpers';
import { applyStyleToDoc } from './wordSplitter';

const splitOversizedWord = (
    doc: jsPDF,
    word: StyledWordInfo,
    maxWidth: number,
    store: RenderStore,
): StyledWordInfo[] => {
    if (!word.text || word.width <= maxWidth || word.isImage) {
        return [word];
    }

    // Set the word's font once for the whole split instead of once per
    // measured prefix: every probe below is then a single getTextWidth
    // instead of a font save/apply/restore cycle (#90).
    const savedFont = doc.getFont();
    const savedSize = doc.getFontSize();
    applyStyleToDoc(doc, word.style, store);
    const charSpace = doc.getCharSpace?.() ?? 0;
    const styledWidth = (text: string): number =>
        doc.getTextWidth(text) + text.length * charSpace;

    try {
        // Work in code points so a split can never cut a surrogate pair,
        // matching the old char-by-char walk.
        const codePoints = Array.from(word.text);
        const chunks: StyledWordInfo[] = [];
        let start = 0;

        while (start < codePoints.length) {
            // Binary-search the break point. The old char-by-char loop
            // stopped at the first prefix wider than maxWidth (keeping the
            // previous prefix), or at the first prefix reaching maxWidth
            // when no prefix exceeded it. Probing whole prefixes keeps
            // kerning identical, so break points are unchanged.
            const rest = codePoints.length - start;
            const prefixWidth = (len: number): number =>
                styledWidth(codePoints.slice(start, start + len).join(''));
            let lo = 1;
            let hi = rest;
            let over = -1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (prefixWidth(mid) > maxWidth) {
                    over = mid;
                    hi = mid - 1;
                } else {
                    lo = mid + 1;
                }
            }
            let len: number;
            if (over === -1) {
                // No prefix exceeds maxWidth: keep the first prefix that
                // reaches it, or the whole remainder.
                let reach = rest;
                lo = 1;
                hi = rest;
                while (lo <= hi) {
                    const mid = (lo + hi) >> 1;
                    if (prefixWidth(mid) >= maxWidth) {
                        reach = mid;
                        hi = mid - 1;
                    } else {
                        lo = mid + 1;
                    }
                }
                len = reach;
            } else {
                len = Math.max(1, over - 1);
            }

            const chunk = codePoints.slice(start, start + len).join('');
            chunks.push({
                ...word,
                text: chunk,
                width: styledWidth(chunk),
                hasTrailingSpace: false,
            });
            start += len;
        }

        if (chunks.length > 0) {
            chunks[chunks.length - 1].hasTrailingSpace = word.hasTrailingSpace;
        }

        return chunks;
    } finally {
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedSize);
    }
};

export const breakIntoLines = (
    doc: jsPDF,
    words: StyledWordInfo[],
    maxWidth: number,
    store: RenderStore,
): StyledLine[] => {
    const normalizedWords: StyledWordInfo[] = [];
    for (const word of words) {
        normalizedWords.push(...splitOversizedWord(doc, word, maxWidth, store));
    }

    const lines: StyledLine[] = [];
    let currentLine: StyledWordInfo[] = [];
    let currentTextWidth = 0;
    let currentLineWidth = 0;
    const baseLineHeight =
        getCharHight(doc) * store.options.page.defaultLineHeightFactor;
    let currentLineHeight = baseLineHeight;
    const spaceWidth = doc.getTextWidth(' ');

    const pushLine = (isLast: boolean) => {
        if (currentLine.length > 0) {
            lines.push({
                words: currentLine,
                totalTextWidth: currentTextWidth,
                isLastLine: isLast,
                lineHeight: currentLineHeight,
            });
        }
    };

    for (const word of normalizedWords) {
        if (word.isBr) {
            pushLine(true);
            currentLine = [];
            currentTextWidth = 0;
            currentLineWidth = 0;
            currentLineHeight = baseLineHeight;
            continue;
        }

        const prev = currentLine[currentLine.length - 1];
        const spaceNeeded = prev?.hasTrailingSpace ? spaceWidth : 0;
        const neededWidth = spaceNeeded + word.width;
        const itemHeight =
            word.isImage && word.imageHeight
                ? word.imageHeight
                : baseLineHeight;

        if (
            currentLineWidth + neededWidth > maxWidth &&
            currentLine.length > 0
        ) {
            pushLine(false);
            currentLine = [word];
            currentTextWidth = word.width;
            currentLineWidth = word.width;
            currentLineHeight = itemHeight;
        } else {
            currentLine.push(word);
            currentTextWidth += word.width;
            currentLineWidth += neededWidth;
            currentLineHeight = Math.max(currentLineHeight, itemHeight);
        }
    }

    pushLine(true);
    return lines;
};
