// src/layout/lineRenderer.ts
import jsPDF from 'jspdf';
import { StyledLine, StyledWordInfo } from '../types/styledWordInfo';
import { RenderStore } from '../store/renderStore';
import { getCharHight, withSavedDocState } from '../utils/doc-helpers';
import { applyStyleToDoc } from './wordSplitter';
import { detectImageFormat } from '../utils/image-utils';

export const renderLine = (
    doc: jsPDF,
    line: StyledLine,
    x: number,
    y: number,
    maxWidth: number,
    store: RenderStore,
    alignment: 'left' | 'right' | 'center' | 'justify' = 'left',
): void => {
    const { words, totalTextWidth, isLastLine } = line;
    if (words.length === 0) return;

    const normalSpaceWidth = doc.getTextWidth(' ');
    let lineWidthWithSpaces = totalTextWidth;
    let expandableSpaces = 0;

    for (let i = 0; i < words.length - 1; i++) {
        if (words[i].hasTrailingSpace) {
            lineWidthWithSpaces += normalSpaceWidth;
            expandableSpaces++;
        }
    }

    let startX = x;
    let wordSpacing = normalSpaceWidth;

    switch (alignment) {
        case 'right':
            startX = x + maxWidth - lineWidthWithSpaces;
            break;
        case 'center':
            startX = x + (maxWidth - lineWidthWithSpaces) / 2;
            break;
        case 'justify':
            if (!isLastLine && expandableSpaces > 0) {
                wordSpacing = (maxWidth - totalTextWidth) / expandableSpaces;
            }
            break;
    }

    const textLineHeight =
        getCharHight(doc) * store.options.page.defaultLineHeightFactor;
    // Justified lines stretch the inter-word spaces, so every word keeps its
    // own text call there; the last line of a justified paragraph uses the
    // normal space width and is safe to merge (issue #88).
    const mergeable = alignment !== 'justify' || isLastLine;
    let currentX = startX;

    let i = 0;
    while (i < words.length) {
        const word = words[i];
        const runEnd = mergeable ? findMergeableRun(words, i) : i + 1;
        if (
            runEnd - i > 1 &&
            renderWordRun(
                doc,
                words.slice(i, runEnd),
                currentX,
                y,
                textLineHeight,
                line.lineHeight,
                wordSpacing,
                store,
            )
        ) {
            currentX += mergedRunAdvance(words, i, runEnd, wordSpacing);
            i = runEnd;
            continue;
        }

        const elementHeight =
            word.isImage && word.imageHeight
                ? word.imageHeight
                : textLineHeight;
        const drawY = word.isImage ? y : y + (line.lineHeight - elementHeight);

        renderSingleWord(doc, word, currentX, drawY, store);
        currentX += word.width;
        if (i < words.length - 1 && word.hasTrailingSpace) {
            currentX += wordSpacing;
        }
        i++;
    }
};

/**
 * How far the cursor advances past a merged run: the drawn text plus the
 * trailing space when the run does not end the line. Identical to the sum of
 * the per-word advances the loop above would have applied (issue #88).
 */
const mergedRunAdvance = (
    words: StyledWordInfo[],
    start: number,
    end: number,
    wordSpacing: number,
): number => {
    let advance = 0;
    for (let k = start; k < end; k++) {
        advance += words[k].width;
        // Like the per-word loop, the cursor steps over a trailing space only
        // when another word follows on the line.
        if (k < words.length - 1 && words[k].hasTrailingSpace) {
            advance += wordSpacing;
        }
    }
    return advance;
};

/**
 * Words merge into one text call only when every drawing input matches: same
 * style (font and colour), same link target and colour, same strikethrough.
 * Images are drawn with `addImage` and always break a run. Decorations that
 * are positioned per word (link annotations, codespan backgrounds,
 * strikethrough rules) are still drawn per word at their exact coordinates;
 * only the glyph run is shared.
 */
const mergeRunKey = (word: StyledWordInfo): string | null => {
    if (word.isImage) {
        return null;
    }
    return [
        word.style,
        word.isLink ? 1 : 0,
        word.href ?? '',
        word.isStrikethrough ? 1 : 0,
        (word.linkColor ?? []).join(','),
    ].join('|');
};

const findMergeableRun = (
    words: StyledWordInfo[],
    start: number,
): number => {
    const key = mergeRunKey(words[start]);
    let end = start + 1;
    while (
        end < words.length &&
        key !== null &&
        mergeRunKey(words[end]) === key
    ) {
        end++;
    }
    return end;
};

/**
 * Draws a run of same-style words with a single `doc.text` call.
 *
 * Returns false — drawing nothing — when the merged string would not occupy
 * exactly the width the layout assumed for the run (kerning across the word
 * boundary, a non-zero charSpace, a style whose space glyph differs from the
 * measured one); the caller then falls back to one call per word. This guard
 * is what guarantees no glyph moves: a merged call is only ever used when it
 * advances the cursor by exactly the laid-out amount.
 */
const renderWordRun = (
    doc: jsPDF,
    run: StyledWordInfo[],
    x: number,
    y: number,
    textLineHeight: number,
    lineHeight: number,
    wordSpacing: number,
    store: RenderStore,
): boolean => {
    let merged = false;
    withSavedDocState(doc, () => {
        const first = run[0];
        applyStyleToDoc(doc, first.style, store);
        if (first.isLink && first.linkColor) {
            doc.setTextColor(...(first.linkColor as [number, number, number]));
        }

        // The inter-word spaces are drawn as space glyphs, exactly as the
        // layout assumed: one `wordSpacing` per trailing space.
        let text = '';
        let drawnWidth = 0;
        for (let k = 0; k < run.length; k++) {
            if (k > 0 && run[k - 1].hasTrailingSpace) {
                text += ' ';
                drawnWidth += wordSpacing;
            }
            text += run[k].text;
            drawnWidth += run[k].width;
        }
        const charSpace = doc.getCharSpace?.() ?? 0;
        const measured =
            doc.getTextWidth(text) + text.length * charSpace;
        if (Math.abs(measured - drawnWidth) > 0.0001) {
            return;
        }

        const drawY = y + (lineHeight - textLineHeight);
        // Per-word decorations keep their exact coordinates; only the glyphs
        // share one call.
        let wordX = x;
        for (let k = 0; k < run.length; k++) {
            const word = run[k];
            if (word.style === 'codespan') {
                renderCodespanBackground(doc, word, wordX, drawY, store);
            }
            if (word.isStrikethrough && word.text) {
                renderStrikethrough(doc, word, wordX, drawY);
            }
            if (word.isLink && word.href) {
                doc.link(wordX, drawY, word.width, doc.getTextDimensions('H').h, {
                    url: word.href,
                });
            }
            wordX += word.width;
            if (k < run.length - 1 && word.hasTrailingSpace) {
                wordX += wordSpacing;
            }
        }

        doc.text(text, x, drawY, { baseline: 'top' });
        merged = true;
    });
    return merged;
};

const renderSingleWord = (
    doc: jsPDF,
    word: StyledWordInfo,
    x: number,
    y: number,
    store: RenderStore,
): void => {
    withSavedDocState(doc, () => {
        applyStyleToDoc(doc, word.style, store);

        if (word.isLink && word.linkColor) {
            doc.setTextColor(...(word.linkColor as [number, number, number]));
        }

        if (word.isImage && word.imageElement?.data) {
            renderInlineImage(doc, word, x, y);
        } else {
            if (word.style === 'codespan') {
                renderCodespanBackground(doc, word, x, y, store);
            }
            doc.text(word.text, x, y, { baseline: 'top' });
            if (word.isStrikethrough && word.text) {
                renderStrikethrough(doc, word, x, y);
            }
        }

        if (word.isLink && word.href) {
            const h =
                word.isImage && word.imageHeight
                    ? word.imageHeight
                    : doc.getTextDimensions('H').h;
            doc.link(x, y, word.width, h, { url: word.href });
        }
    });
};

const renderCodespanBackground = (
    doc: jsPDF,
    word: StyledWordInfo,
    x: number,
    y: number,
    store: RenderStore,
): void => {
    const opts = store.options.codespan ?? {};
    if (opts.showBackground === false) return;
    const bg = opts.backgroundColor ?? '#EEEEEE';
    const pad = opts.padding ?? 0.8;
    const h = doc.getTextDimensions('H').h;
    doc.setFillColor(bg);
    doc.rect(x - pad, y - pad, word.width + pad * 2, h + pad * 2, 'F');
    doc.setFillColor('#000000');
};

/**
 * Draws the rule for a GFM strikethrough word. jsPDF has no text-decoration,
 * so the line is drawn manually across the glyph run at roughly x-height.
 */
const renderStrikethrough = (
    doc: jsPDF,
    word: StyledWordInfo,
    x: number,
    y: number,
): void => {
    const h = doc.getTextDimensions('H').h;
    const lineY = y + h * 0.55;
    const savedDraw = doc.getDrawColor();
    const savedWidth = doc.getLineWidth();
    // Match the rule colour to the text so it reads as one decorated run.
    doc.setDrawColor(doc.getTextColor());
    doc.setLineWidth(Math.max(0.1, doc.getFontSize() / 100));
    doc.line(x, lineY, x + word.width, lineY);
    doc.setDrawColor(savedDraw);
    doc.setLineWidth(savedWidth);
};

const renderInlineImage = (
    doc: jsPDF,
    word: StyledWordInfo,
    x: number,
    y: number,
): void => {
    const el = word.imageElement!;
    const fmt = detectImageFormat(el);
    if (word.width > 0 && (word.imageHeight || 0) > 0) {
        doc.addImage(el.data!, fmt, x, y, word.width, word.imageHeight!);
    }
};
