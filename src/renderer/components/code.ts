import jsPDF from 'jspdf';
import { ParsedElement } from '../../types';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { RenderStore } from '../../store/renderStore';

const renderCodeBlock = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    hasRawBullet: boolean,
) => {
    // Save current font state
    const savedFont = doc.getFont();
    const savedFontSize = doc.getFontSize();

    // Set code font BEFORE measurements to ensure proper width/height calculation
    doc.setFont('courier', 'normal');
    const codeFontSize = RenderStore.options.page.defaultFontSize * 0.9;
    doc.setFontSize(codeFontSize);

    const indent = indentLevel * RenderStore.options.page.indent;
    const maxWidth = RenderStore.options.page.maxContentWidth - indent - 8; // Account for internal padding

    // Calculate line height using jsPDF's internal method for consistency
    const lineHeightFactor = doc.getLineHeightFactor();
    const lineHeight =
        (codeFontSize / doc.internal.scaleFactor) * lineHeightFactor;

    // Trim content to remove trailing whitespace/newlines that cause extra space
    const rawContent = element.code ?? '';
    // Remove all trailing newlines/whitespace
    const content = rawContent.replace(/[\r\n\s]+$/, '');

    // Guard against empty content
    if (!content) {
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedFontSize);
        return;
    }

    // Split into lines (now with correct courier font for width measurement)
    const lines: string[] = doc.splitTextToSize(content, maxWidth);

    // Remove trailing empty lines that can appear after splitTextToSize
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
    }

    // Guard against no lines after filtering
    if (lines.length === 0) {
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedFontSize);
        return;
    }

    // Config for code block
    const padding = 4; // Fixed padding for code blocks
    const bgColor = '#EEEEEE';
    const drawColor = '#DDDDDD';

    let currentLineIndex = 0;

    while (currentLineIndex < lines.length) {
        const availableHeight =
            RenderStore.options.page.maxContentHeight - RenderStore.Y;
        const remainingLines = lines.length - currentLineIndex;

        // Calculate how many lines fit on this page (accounting for padding)
        const effectiveAvailable = availableHeight - padding * 2;
        let linesToRenderCount = Math.floor(effectiveAvailable / lineHeight);

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
        const isFirstChunk = currentLineIndex === 0;
        const isLastChunk =
            currentLineIndex + linesToRenderCount >= lines.length;

        const textBlockHeight = linesToRenderCount * lineHeight;

        if (isFirstChunk) {
            RenderStore.updateY(padding, 'add');
        }

        // Draw Background
        doc.setFillColor(bgColor);
        doc.setDrawColor(drawColor);
        doc.roundedRect(
            RenderStore.X,
            RenderStore.Y - padding,
            RenderStore.options.page.maxContentWidth,
            textBlockHeight +
                (isFirstChunk ? padding : 0) +
                (isLastChunk ? padding : 0),
            2,
            2,
            'FD',
        );

        // Render Language Label (only on first chunk)
        if (isFirstChunk && element.lang) {
            const savedCodeFontSize = doc.getFontSize();
            doc.setFontSize(10);
            doc.setTextColor('#666666');
            doc.text(
                element.lang,
                RenderStore.X +
                    RenderStore.options.page.maxContentWidth -
                    doc.getTextWidth(element.lang) -
                    4,
                RenderStore.Y,
                { baseline: 'top' },
            );
            doc.setFontSize(savedCodeFontSize);
            doc.setTextColor('#000000');
        }

        // Render code text line by line
        let yPos = RenderStore.Y;
        for (const line of linesToRender) {
            doc.text(line, RenderStore.X + 4, yPos, { baseline: 'top' });
            yPos += lineHeight;
        }

        // Update Y cursor by exact amount rendered
        RenderStore.updateY(textBlockHeight, 'add');

        // Record visual bottom (including potential bottom padding)
        RenderStore.recordContentY(RenderStore.Y + (isLastChunk ? padding : 0));

        if (isLastChunk) {
            RenderStore.updateY(padding, 'add');
        }

        currentLineIndex += linesToRenderCount;

        // If we still have lines, break to next page
        if (currentLineIndex < lines.length) {
            HandlePageBreaks(doc);
        }
    }

    // Restore font state
    doc.setFont(savedFont.fontName, savedFont.fontStyle);
    doc.setFontSize(savedFontSize);
};

export default renderCodeBlock;
