// src/layout/lineRenderer.ts
import jsPDF from 'jspdf';
import { StyledLine, StyledWordInfo } from '../types/styledWordInfo';
import { RenderStore } from '../store/renderStore';
import { getCharHight, withSavedDocState } from '../utils/doc-helpers';
import { applyStyleToDoc } from './wordSplitter';
import { detectImageFormat } from '../utils/image-utils';
import { standardWidth } from './standardFontWidths';

/**
 * Test-only kill switch for word-run merging (issue #111).
 *
 * When false, `renderLine` draws every word with its own `text()` call — the
 * exact pre-PR path — so the glyph-position regression test can compare the
 * merged output against it PDF-for-PDF. Always true in production.
 */
let wordRunMergingEnabled = true;

export const setWordRunMergingEnabled = (enabled: boolean): void => {
    wordRunMergingEnabled = enabled;
};

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
    const mergeable =
        wordRunMergingEnabled && (alignment !== 'justify' || isLastLine);
    let currentX = startX;

    let i = 0;
    while (i < words.length) {
        const word = words[i];
        const runEnd = mergeable ? findMergeableRun(words, i) : i + 1;
        if (
            runEnd - i > 1 &&
            renderWordRun(
                doc,
                words,
                i,
                runEnd,
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
 * Returns false — drawing nothing — when any word would not land within
 * 0.01pt of the x the pre-PR per-word loop gave it; the caller then falls
 * back to one `text()` call per word, which is position-exact by
 * construction. A total-width `getTextWidth` check cannot prove this: a
 * viewer shapes a plain `(w1 w2) Tj` with the font's real advance widths
 * (Adobe AFM for the 14 standard PDF fonts), while jsPDF measures with its
 * own width tables (off by up to 6/1000 em per glyph) and applies kerning
 * pairs no viewer applies — so per-word origins drifted by up to ~3.7pt
 * even when the totals matched (issue #111).
 */
const renderWordRun = (
    doc: jsPDF,
    words: StyledWordInfo[],
    start: number,
    end: number,
    x: number,
    y: number,
    textLineHeight: number,
    lineHeight: number,
    wordSpacing: number,
    store: RenderStore,
): boolean => {
    const first = words[start];

    // Phase 1: model the run's font and check the per-word guard. Only the
    // font/size are touched — never the text color. jsPDF's
    // setTextColor(getTextColor()) round-trip loses precision (precision 3 +
    // Math.floor), so a failed guard must not perturb the color the fallback
    // path will draw with.
    const checkGuard = (): boolean => {
        const savedFont = doc.getFont();
        const savedSize = doc.getFontSize();
        try {
            applyStyleToDoc(doc, first.style, store);
            return runPreservesWordOrigins(
                doc,
                words,
                start,
                end,
                x,
                wordSpacing,
            );
        } finally {
            doc.setFont(savedFont.fontName, savedFont.fontStyle);
            doc.setFontSize(savedSize);
        }
    };
    if (!checkGuard()) {
        return false;
    }

    // Phase 2: the guard passed — draw the merged run.
    const drawFont = doc.getFont();
    const drawSize = doc.getFontSize();
    const savedColor = doc.getTextColor();
    const colorChanged = !!(first.isLink && first.linkColor);
    try {
        applyStyleToDoc(doc, first.style, store);
        if (colorChanged) {
            doc.setTextColor(...(first.linkColor as [number, number, number]));
        }

        // The inter-word spaces are drawn as space glyphs, exactly as the
        // layout assumed: one `wordSpacing` per trailing space.
        let text = '';
        for (let k = start; k < end; k++) {
            if (k > start && words[k - 1].hasTrailingSpace) {
                text += ' ';
            }
            text += words[k].text;
        }

        const drawY = y + (lineHeight - textLineHeight);
        // Per-word decorations keep their exact coordinates; only the glyphs
        // share one call.
        let wordX = x;
        for (let k = start; k < end; k++) {
            const word = words[k];
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
            if (k < end - 1 && word.hasTrailingSpace) {
                wordX += wordSpacing;
            }
        }

        doc.text(text, x, drawY, { baseline: 'top' });
    } finally {
        doc.setFont(drawFont.fontName, drawFont.fontStyle);
        doc.setFontSize(drawSize);
        // Restore the color only when we changed it: the
        // setTextColor(getTextColor()) round-trip is lossy in jsPDF.
        if (colorChanged) {
            doc.setTextColor(savedColor);
        }
    }
    return true;
};

/**
 * How far a glyph origin may move, in PDF points, when words share one
 * `text()` call: 0.01pt (issue #111).
 */
const GLYPH_ORIGIN_TOLERANCE_PT = 0.01;

/**
 * Whether drawing words[start..end) with one `doc.text` call keeps every
 * word's glyph origin within 0.01pt of the x the pre-PR per-word loop gave
 * it.
 *
 * The viewer lays out the merged `(w1 w2 …) Tj` with the font's real advance
 * widths, so each word's merged origin is predicted with the Adobe AFM
 * widths of the 14 standard PDF fonts (the PDF carries no /Widths for
 * them); the old x comes from the exact cursor math of the pre-PR loop
 * (`word.width`, plus one `wordSpacing` per trailing space except after the
 * line's last word). A run no viewer model covers — a font outside the 14
 * standard ones, or a glyph outside the AFM table's 32..126 — is never
 * merged.
 */
const runPreservesWordOrigins = (
    doc: jsPDF,
    words: StyledWordInfo[],
    start: number,
    end: number,
    x: number,
    wordSpacing: number,
): boolean => {
    const font = doc.getFont();
    const fontSize = doc.getFontSize();
    const scaleFactor = doc.internal.scaleFactor;
    const charSpace = doc.getCharSpace?.() ?? 0;
    const tolerance = GLYPH_ORIGIN_TOLERANCE_PT / scaleFactor;

    // Viewer advance of a string in doc units: real AFM advances plus the Tc
    // the merged text() call emits after every glyph. Null when a glyph
    // cannot be modelled the way a viewer shapes it.
    const viewerAdvance = (text: string): number | null => {
        let em = 0;
        for (let i = 0; i < text.length; i++) {
            const adv = standardWidth(
                font.fontName,
                font.fontStyle,
                text.charCodeAt(i),
            );
            if (adv === null) return null;
            em += adv;
        }
        return (em * fontSize) / scaleFactor + text.length * charSpace;
    };

    // oldX tracks the pre-PR x of word k; prefix is the merged-string text
    // before word k, whose viewer advance is word k's merged origin.
    let oldX = x;
    let prefix = '';
    for (let k = start; k < end; k++) {
        if (k > start) {
            const predicted = viewerAdvance(prefix);
            if (
                predicted === null ||
                Math.abs(x + predicted - oldX) > tolerance
            ) {
                return false;
            }
        }
        const word = words[k];
        oldX += word.width;
        if (k < words.length - 1 && word.hasTrailingSpace) {
            oldX += wordSpacing;
        }
        prefix += word.text;
        if (word.hasTrailingSpace) {
            prefix += ' ';
        }
    }
    return true;
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
