// src/utils/justifiedTextRenderer.ts
import jsPDF from 'jspdf';
import { ParsedElement } from '../types/parsedElement';
import { RenderStore } from '../store/renderStore';
import { breakIntoLines, flattenToWords, renderInlineContent } from '../layout';

/**
 * @deprecated JustifiedTextRenderer is deprecated in v4.0.0.
 * It remains only as a facade for backward compatibility.
 * Please use `renderInlineContent` from `src/layout/` instead.
 */
export class JustifiedTextRenderer {
    static renderStyledParagraph(
        doc: jsPDF,
        elements: ParsedElement[],
        x: number,
        y: number,
        maxWidth: number,
        store: RenderStore,
        alignment?: 'left' | 'right' | 'center' | 'justify',
    ): void {
        renderInlineContent(doc, elements, x, y, maxWidth, store, {
            alignment,
        });
    }

    /**
     * @deprecated Use renderStyledParagraph instead
     */
    static renderJustifiedParagraph(
        doc: jsPDF,
        elements: ParsedElement[],
        x: number,
        y: number,
        maxWidth: number,
        store: RenderStore,
    ): void {
        this.renderStyledParagraph(doc, elements, x, y, maxWidth, store);
    }

    /** @deprecated */
    static flattenToWords = flattenToWords;

    /** @deprecated */
    static breakIntoLines = breakIntoLines;
}
