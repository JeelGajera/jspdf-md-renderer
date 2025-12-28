import jsPDF from 'jspdf';
import { ParsedElement } from '../../types';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';

const renderCodeBlock = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    hasRawBullet: boolean,
) => {
    const indent = indentLevel * RenderStore.options.page.indent;
    const maxWidth = RenderStore.options.page.maxContentWidth - indent;
    const lineHeight = getCharHight(doc);
    const content = element.code ?? '';
    const lines = doc.splitTextToSize(content, maxWidth);

    // Config for code block
    const padding = RenderStore.options.page.lineSpace ?? 4;
    const bgColor = '#EEEEEE';
    const drawColor = '#eee';

    let currentLineIndex = 0;

    while (currentLineIndex < lines.length) {
        const availableHeight =
            RenderStore.options.page.maxContentHeight - RenderStore.Y;
        const remainingLines = lines.length - currentLineIndex;

        // Calculate how many lines fit on this page
        let linesToRenderCount = Math.floor(availableHeight / lineHeight);

        if (linesToRenderCount <= 0) {
            HandlePageBreaks(doc);
            continue;
        }

        if (linesToRenderCount > remainingLines) {
            linesToRenderCount = remainingLines;
        }

        const linesToRender = lines.slice(
            currentLineIndex,
            currentLineIndex + linesToRenderCount,
        );
        const isLastChunk = linesToRenderCount === remainingLines;

        // Calculate block height for background
        const blockHeight = linesToRenderCount * lineHeight;

        // Adjust Y for padding if it's the start of the block
        if (currentLineIndex === 0) {
            RenderStore.updateY(padding, 'add');
        }

        // Draw Background
        doc.setFillColor(bgColor);
        doc.setDrawColor(drawColor);
        doc.roundedRect(
            RenderStore.X,
            RenderStore.Y - padding,
            RenderStore.options.page.maxContentWidth,
            blockHeight + padding + (isLastChunk ? padding : 0),
            2,
            2,
            'FD',
        );

        // Render Language Label (only on first chunk)
        if (currentLineIndex === 0 && element.lang) {
            doc.setFontSize(10);
            doc.text(
                element.lang,
                RenderStore.X +
                    RenderStore.options.page.maxContentWidth -
                    doc.getTextWidth(element.lang) -
                    RenderStore.options.page.lineSpace / 2,
                RenderStore.Y,
            );
        }

        // Render Lines
        doc.setFontSize(RenderStore.options.page.defaultFontSize);

        // doc.text can handle array of strings
        doc.text(linesToRender, RenderStore.X + 4, RenderStore.Y);

        // Update cursors
        const renderedHeight = linesToRenderCount * lineHeight;
        RenderStore.updateY(renderedHeight, 'add');
        currentLineIndex += linesToRenderCount;

        // If we still have lines, break page
        if (currentLineIndex < lines.length) {
            HandlePageBreaks(doc);
            // Reset Y for next page is handled by HandlePageBreaks
            RenderStore.updateY(padding, 'add');
        }
    }

    // Final padding adjustment
    RenderStore.updateY(padding, 'add');
};

export default renderCodeBlock;
