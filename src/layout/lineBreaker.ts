// src/layout/lineBreaker.ts
import jsPDF from 'jspdf';
import { StyledWordInfo, StyledLine } from '../types/styledWordInfo';
import { RenderStore } from '../store/renderStore';
import { getCharHight } from '../utils/doc-helpers';
import { measureStyledWidth } from './wordSplitter';

const splitOversizedWord = (
    doc: jsPDF,
    word: StyledWordInfo,
    maxWidth: number,
    store: RenderStore,
): StyledWordInfo[] => {
    if (!word.text || word.width <= maxWidth || word.isImage) {
        return [word];
    }

    const chunks: StyledWordInfo[] = [];
    let remaining = word.text;

    while (remaining.length > 0) {
        let chunk = '';

        for (const ch of remaining) {
            const candidate = chunk + ch;
            const candidateWidth = measureStyledWidth(
                doc,
                candidate,
                word.style,
                store,
            );
            if (candidateWidth > maxWidth && chunk.length > 0) break;
            chunk = candidate;
            if (candidateWidth >= maxWidth) break;
        }

        if (!chunk) {
            chunk = remaining.charAt(0);
        }

        chunks.push({
            ...word,
            text: chunk,
            width: measureStyledWidth(doc, chunk, word.style, store),
            hasTrailingSpace: false,
        });

        remaining = remaining.slice(chunk.length);
    }

    if (chunks.length > 0) {
        chunks[chunks.length - 1].hasTrailingSpace = word.hasTrailingSpace;
    }

    return chunks;
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
