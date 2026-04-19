import jsPDF from 'jspdf';
import { ParsedElement } from '../../types';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { RenderStore } from '../../store/renderStore';

const renderCodeBlock = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    store: RenderStore,
) => {
    // Save current font state
    const savedFont = doc.getFont();
    const savedFontSize = doc.getFontSize();

    // Set code font BEFORE measurements to ensure proper width/height calculation
    doc.setFont('courier', 'normal');
    const codeFontSize = store.options.page.defaultFontSize * 0.9;
    doc.setFontSize(codeFontSize);

    const indent = indentLevel * store.options.page.indent;
    const maxWidth = store.options.page.maxContentWidth - indent - 8; // Account for internal padding

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
        const availableHeight = store.options.page.maxContentHeight - store.Y;
        const remainingLines = lines.length - currentLineIndex;

        // Calculate how many lines fit on this page (accounting for padding)
        const effectiveAvailable = availableHeight - padding * 2;
        let linesToRenderCount = Math.floor(effectiveAvailable / lineHeight);

        if (linesToRenderCount <= 0) {
            HandlePageBreaks(doc, store);
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
            store.updateY(padding, 'add');
        }

        // Draw Background
        doc.setFillColor(bgColor);
        doc.setDrawColor(drawColor);
        doc.roundedRect(
            store.X,
            store.Y - padding,
            store.options.page.maxContentWidth,
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
                store.X +
                    store.options.page.maxContentWidth -
                    doc.getTextWidth(element.lang) -
                    4,
                store.Y,
                { baseline: 'top' },
            );
            doc.setFontSize(savedCodeFontSize);
            doc.setTextColor('#000000');
        }

        // Render code text line by line
        let yPos = store.Y;
        for (const line of linesToRender) {
            doc.text(line, store.X + 4, yPos, { baseline: 'top' });
            yPos += lineHeight;
        }

        // Update Y cursor by exact amount rendered
        store.updateY(textBlockHeight, 'add');

        // Record visual bottom (including potential bottom padding)
        store.recordContentY(store.Y + (isLastChunk ? padding : 0));

        if (isLastChunk) {
            store.updateY(padding, 'add');
        }

        currentLineIndex += linesToRenderCount;

        // If we still have lines, break to next page
        if (currentLineIndex < lines.length) {
            HandlePageBreaks(doc, store);
        }
    }

    // Restore font state
    doc.setFont(savedFont.fontName, savedFont.fontStyle);
    doc.setFontSize(savedFontSize);
};

export default renderCodeBlock;
