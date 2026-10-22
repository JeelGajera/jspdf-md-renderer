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

        // Seed the per-chunk length estimate from a small sample so the
        // first geometric probe starts near the fitting line length; every
        // later chunk reuses the previous chunk's length. Probes then
        // measure prefixes close to the final break point instead of
        // re-measuring huge prefixes (#107).
        const sampleLen = Math.min(64, codePoints.length);
        const sampleWidth = styledWidth(
            codePoints.slice(0, sampleLen).join(''),
        );
        let estLen =
            sampleWidth > 0
                ? Math.max(
                      1,
                      Math.floor((maxWidth / sampleWidth) * sampleLen),
                  )
                : 1;

        const prefixWidth = (len: number): number =>
            styledWidth(codePoints.slice(start, start + len).join(''));

        while (start < codePoints.length) {
            // Find the break point. The old char-by-char loop kept the
            // first prefix reaching maxWidth, or the prefix just before
            // the first one wider than maxWidth. Probing whole prefixes
            // keeps kerning identical, so break points are unchanged.
            const rest = codePoints.length - start;

            let len: number;
            if (!(maxWidth > 0)) {
                // Degenerate line width: fall back to one char per chunk,
                // exactly as the old walk did.
                len = 1;
            } else {
                // Bound the search near the fitting line length with
                // geometric probes starting from the estimate: find a
                // tight [lo, hi] window with prefixWidth(lo) < maxWidth
                // <= prefixWidth(hi). No probe ever measures the whole
                // remainder except the single final-chunk check (#107).
                let lo = 0;
                let hi = -1;
                const probe = Math.min(Math.max(estLen, 1), rest);
                if (prefixWidth(probe) >= maxWidth) {
                    hi = probe;
                    let down = probe;
                    while (down > 1) {
                        const half = down >> 1;
                        if (prefixWidth(half) >= maxWidth) {
                            hi = half;
                            down = half;
                        } else {
                            lo = half;
                            break;
                        }
                    }
                } else {
                    lo = probe;
                    for (;;) {
                        const next = lo * 2;
                        if (next >= rest) {
                            // Reaching the remainder: it is the final
                            // chunk iff it fits; this is the only probe
                            // that ever measures the whole remainder.
                            if (prefixWidth(rest) < maxWidth) {
                                hi = -1;
                            } else {
                                hi = rest;
                            }
                            break;
                        }
                        if (prefixWidth(next) >= maxWidth) {
                            hi = next;
                            break;
                        }
                        lo = next;
                    }
                }

                if (hi === -1) {
                    // No prefix reaches maxWidth: keep the whole remainder,
                    // exactly as the old walk did.
                    len = rest;
                } else {
                    // Binary-search the first prefix reaching maxWidth
                    // inside the tight window.
                    let reach = hi;
                    let a = lo + 1;
                    let b = hi;
                    while (a <= b) {
                        const mid = (a + b) >> 1;
                        if (prefixWidth(mid) >= maxWidth) {
                            reach = mid;
                            b = mid - 1;
                        } else {
                            a = mid + 1;
                        }
                    }
                    // The old walk stopped right after a prefix that merely
                    // reached maxWidth, but one char earlier once a prefix
                    // went strictly over it.
                    len =
                        prefixWidth(reach) === maxWidth
                            ? reach
                            : Math.max(1, reach - 1);
                }
            }
            estLen = len;

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
