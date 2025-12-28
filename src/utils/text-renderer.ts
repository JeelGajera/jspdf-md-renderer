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
        const lineHeight = getCharHight(doc);

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
                // Use justifyText utility for this line
                // But justifyText expects a full block. We need to check if it's the last line of paragraph.
                // splitTextToSize doesn't tell us if it's a hard break or soft break.
                // For simplified justification:
                // If it's the last line of the split result, default align.
                // Else, justify.

                if (i === lines.length - 1) {
                    doc.text(line, x, currentY);
                } else {
                    // We can't easily use existing justifyText on a single pre-split line because
                    // justifyText splits it again.
                    // We should likely refactor justifyText or use a simplified justification here.
                    // For now, let's reuse justifyText but we need to be careful.
                    // Actually, the existing renderParagraph logic tries to justify the WHOLE block.
                    // But dealing with page breaks mid-block is hard with that approach.

                    // Alternative:
                    doc.text(line, x, currentY, {
                        maxWidth: maxWidth,
                        align: 'justify',
                    });
                }
            } else {
                doc.text(line, x, currentY);
            }

            currentY += lineHeight;
            RenderStore.updateY(lineHeight, 'add');
        }

        return currentY;
    }
}
