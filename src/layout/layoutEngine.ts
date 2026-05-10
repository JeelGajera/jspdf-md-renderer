// src/layout/layoutEngine.ts
import jsPDF from 'jspdf';
import { ParsedElement } from '../types/parsedElement';
import { RenderStore } from '../store/renderStore';
import { HandlePageBreaks } from '../utils/handlePageBreak';
import { getCharHight } from '../utils/doc-helpers';
import { flattenToWords } from './wordSplitter';
import { breakIntoLines } from './lineBreaker';
import { renderLine } from './lineRenderer';

export interface LayoutOptions {
    alignment?: 'left' | 'right' | 'center' | 'justify';
    /** When true, the last line advances Y by only the raw text height
     *  (no trailing inter-line spacing), so the caller's explicit
     *  bottomSpacing is the sole gap after the block. */
    trimLastLine?: boolean;
}

/**
 * THE single entry point for rendering any mixed inline content.
 * All paragraph, heading, list item, and blockquote text must go through here.
 *
 * Handles: word splitting, line breaking, page breaks, styled rendering.
 * Returns the final Y position after rendering.
 */
export const renderInlineContent = (
    doc: jsPDF,
    elements: ParsedElement[],
    x: number,
    y: number,
    maxWidth: number,
    store: RenderStore,
    opts: LayoutOptions = {},
): number => {
    const alignment =
        opts.alignment ?? store.options.content?.textAlignment ?? 'left';
    const trimLastLine = opts.trimLastLine ?? false;

    const words = flattenToWords(doc, elements, store);
    if (words.length === 0) return y;

    const lines = breakIntoLines(doc, words, maxWidth, store);

    let currentY = y;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (currentY + line.lineHeight > store.options.page.maxContentHeight) {
            HandlePageBreaks(doc, store);
            currentY = store.Y;
        }

        renderLine(
            doc,
            line,
            x,
            currentY,
            maxWidth,
            store,
            alignment as 'left' | 'right' | 'center' | 'justify',
        );

        const isLast = i === lines.length - 1;
        // For the last line of block-level elements (when trimLastLine is set),
        // advance by only the raw text height so the caller's bottomSpacing
        // is the sole gap. Otherwise use the full lineHeight.
        const shouldTrim = isLast && trimLastLine
            && !line.words.some((w) => w.isImage && w.imageHeight);
        const yAdvance = shouldTrim
            ? getCharHight(doc)
            : line.lineHeight;

        store.recordContentY(currentY + yAdvance);
        currentY += yAdvance;
        store.updateY(yAdvance, 'add');
    }

    // Update X to end of last line
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
        let spaceCount = 0;
        for (let i = 0; i < lastLine.words.length - 1; i++) {
            if (lastLine.words[i].hasTrailingSpace) spaceCount++;
        }
        const lastLineW =
            lastLine.totalTextWidth + spaceCount * doc.getTextWidth(' ');
        store.updateX(x + lastLineW, 'set');
    }

    return currentY;
};

/**
 * Render a single string of plain (unstyled) text with wrapping and page breaks.
 * Use this for simple text in list items and raw items where there are no inline styles.
 */
export const renderPlainText = (
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    store: RenderStore,
    opts: LayoutOptions = {},
): number => {
    const textEl: ParsedElement = { type: 'text', content: text };
    return renderInlineContent(doc, [textEl], x, y, maxWidth, store, opts);
};

export { flattenToWords, breakIntoLines, renderLine };
