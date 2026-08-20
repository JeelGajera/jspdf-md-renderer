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
    let currentX = startX;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
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
    }
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
