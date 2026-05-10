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
    const savedTextColor = doc.getTextColor();
    const savedDrawColor = doc.getDrawColor();
    const savedFillColor = doc.getFillColor();

    // Set code font BEFORE measurements to ensure proper width/height calculation
    const codeFont = store.options.font.code || {
        name: 'courier',
        style: 'normal',
    };
    doc.setFont(codeFont.name, codeFont.style);
    const codeOpts = store.options.codeBlock ?? {};
    const codeFontSizeScale = codeOpts.fontSizeScale ?? 0.9;
    const codeFontSize = store.options.page.defaultFontSize * codeFontSizeScale;
    doc.setFontSize(codeFontSize);

    const indent = indentLevel * store.options.page.indent;
    const padding = codeOpts.padding ?? 4;
    const maxWidth = store.options.page.maxContentWidth - indent - padding * 2;

    // Calculate line height using jsPDF's internal method for consistency
    const lineHeightFactor = doc.getLineHeightFactor();
    const lineHeight =
        (codeFontSize / doc.internal.scaleFactor) * lineHeightFactor;

    // Trim content to remove trailing whitespace/newlines that cause extra space
    const rawContent = element.code ?? '';
    const content = rawContent.replace(/[\r\n\s]+$/, '');

    // Guard against empty content
    if (!content) {
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedFontSize);
        return;
    }

    // Split into lines
    const lines: string[] = doc.splitTextToSize(content, maxWidth);

    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
    }

    if (lines.length === 0) {
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedFontSize);
        return;
    }

    // Config for code block
    const bgColor = codeOpts.backgroundColor ?? '#F6F8FA';
    const drawColor = codeOpts.borderColor ?? '#E1E4E8';
    const radius = codeOpts.borderRadius ?? 2;

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
            radius,
            radius,
            'FD',
        );

        // Render Language Label (only on first chunk)
        if (
            isFirstChunk &&
            element.lang &&
            codeOpts.showLanguageLabel !== false
        ) {
            const savedCodeFontSize = doc.getFontSize();
            doc.setFontSize(10);
            doc.setTextColor(codeOpts.labelColor ?? '#666666');
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
            doc.setTextColor(savedTextColor);
        }

        // Render code text line by line
        let yPos = store.Y;
        doc.setTextColor(codeOpts.textColor ?? '#000000');
        for (const line of linesToRender) {
            doc.text(line, store.X + 4, yPos, { baseline: 'top' });
            yPos += lineHeight;
        }
        doc.setTextColor(savedTextColor);

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
    doc.setTextColor(savedTextColor);
    doc.setDrawColor(savedDrawColor);
    doc.setFillColor(savedFillColor);
    store.updateY(store.options.spacing?.afterCodeBlock ?? 3, 'add');
};

export default renderCodeBlock;
