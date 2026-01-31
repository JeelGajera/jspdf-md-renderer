import jsPDF from 'jspdf';
import { RenderStore } from '../store/renderStore';
import { getCharHight } from './doc-helpers';
import { HandlePageBreaks } from './handlePageBreak';

export class TextRenderer {
    /**
     * Renders text with automatic line wrapping and page breaking.
     * @param doc jsPDF instance
     * @param text Text to render
     * @param x X coordinate (if not provided, uses RenderStore.X)
     * @param y Y coordinate (if not provided, uses RenderStore.Y)
     * @param maxWidth Max width for text wrapping
     * @param justify Whether to justify the text
     */
    static renderText(
        doc: jsPDF,
        text: string,
        x: number = RenderStore.X,
        y: number = RenderStore.Y,
        maxWidth: number,
        justify: boolean = false,
    ) {
        // Use document splitTextToSize to handle wrapping
        const lines: string[] = doc.splitTextToSize(text, maxWidth);
        const charHeight = getCharHight(doc);
        const lineHeight =
            charHeight * RenderStore.options.page.defaultLineHeightFactor;

        let currentY = y;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check if we need a page break
            if (
                currentY + lineHeight >
                RenderStore.options.page.maxContentHeight
            ) {
                HandlePageBreaks(doc);
                currentY = RenderStore.Y; // Update currentY to new page top
            }

            // Render line
            if (justify) {
                if (i === lines.length - 1) {
                    doc.text(line, x, currentY, { baseline: 'top' });
                } else {
                    doc.text(line, x, currentY, {
                        maxWidth: maxWidth,
                        align: 'justify',
                        baseline: 'top',
                    });
                }
            } else {
                doc.text(line, x, currentY, { baseline: 'top' });
            }

            // Record the visual bottom of the text on this line
            RenderStore.recordContentY(currentY + charHeight);

            currentY += lineHeight;
            RenderStore.updateY(lineHeight, 'add');
        }

        return currentY;
    }
}
