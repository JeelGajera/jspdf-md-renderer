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

    // Record each word's draw position so same-link underline runs can be
    // drawn as one continuous rule afterwards.
    const wordXs: number[] = [];
    const wordDrawYs: number[] = [];
    let currentX = startX;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const elementHeight =
            word.isImage && word.imageHeight
                ? word.imageHeight
                : textLineHeight;
        const drawY = word.isImage ? y : y + (line.lineHeight - elementHeight);

        wordXs.push(currentX);
        wordDrawYs.push(drawY);
        renderSingleWord(doc, word, currentX, drawY, store);
        currentX += word.width;
        if (i < words.length - 1 && word.hasTrailingSpace) {
            currentX += wordSpacing;
        }
    }

    renderLinkUnderlines(doc, words, wordXs, wordDrawYs, store);
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
            // Link underlines are drawn per same-link run in
            // renderLinkUnderlines, not per word, so a multi-word link gets
            // one continuous rule instead of per-word rules with gaps.
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

/**
 * Draws one continuous underline rule per same-link run on the line.
 *
 * A run is a maximal sequence of adjacent underlined link words that share
 * the same href. The rule spans the whole run — including the spaces between
 * its words (which may be stretched under justification) — so a multi-word
 * link reads as a single underlined link. Distinct links always produce
 * separate, non-overlapping rules, preserving the boundary between them.
 */
const renderLinkUnderlines = (
    doc: jsPDF,
    words: StyledWordInfo[],
    wordXs: number[],
    wordDrawYs: number[],
    store: RenderStore,
): void => {
    let runStart = -1;

    const flushRun = (runEnd: number): void => {
        if (runStart >= 0) {
            drawUnderlineRun(
                doc,
                words,
                wordXs,
                wordDrawYs,
                runStart,
                runEnd,
                store,
            );
        }
    };

    for (let i = 0; i <= words.length; i++) {
        const word = i < words.length ? words[i] : undefined;
        const underlined =
            !!word && !!word.linkUnderline && !!word.text && !word.isImage;
        const continuesRun =
            underlined && runStart >= 0 && word?.href === words[runStart].href;
        if (!continuesRun) {
            flushRun(i);
            runStart = underlined ? i : -1;
        }
    }
};

const drawUnderlineRun = (
    doc: jsPDF,
    words: StyledWordInfo[],
    wordXs: number[],
    wordDrawYs: number[],
    runStart: number,
    runEnd: number,
    store: RenderStore,
): void => {
    const first = words[runStart];
    const last = words[runEnd - 1];
    withSavedDocState(doc, () => {
        applyStyleToDoc(doc, first.style, store);
        if (first.linkColor) {
            doc.setTextColor(...(first.linkColor as [number, number, number]));
        }
        const h = doc.getTextDimensions('H').h;
        // Text is drawn with baseline 'top', so the underline sits just below
        // the text block with a small gap for descenders.
        const lineY = wordDrawYs[runStart] + h * 1.08;
        const savedDraw = doc.getDrawColor();
        const savedWidth = doc.getLineWidth();
        // Match the rule colour to the text so it reads as one decorated run.
        doc.setDrawColor(doc.getTextColor());
        doc.setLineWidth(Math.max(0.1, doc.getFontSize() / 120));
        doc.line(
            wordXs[runStart],
            lineY,
            wordXs[runEnd - 1] + last.width,
            lineY,
        );
        doc.setDrawColor(savedDraw);
        doc.setLineWidth(savedWidth);
    });
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
