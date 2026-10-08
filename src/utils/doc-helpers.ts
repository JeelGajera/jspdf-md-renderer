import jsPDF from 'jspdf';

export const getCharHight = (doc: jsPDF): number => {
    // Use raw font height (fontSize / scaleFactor) instead of getTextDimensions
    // which includes jsPDF's internal lineHeightFactor (~1.15). This avoids
    // double line-height-factoring when callers multiply by defaultLineHeightFactor.
    return doc.getFontSize() / doc.internal.scaleFactor;
};

export const getCharWidth = (doc: jsPDF): number => {
    return doc.getTextDimensions('H').w;
};

/**
 * Saves the current jsPDF font, size, text color, fill color, draw color and
 * line width, executes `fn`, then restores those properties — even if `fn`
 * throws.
 *
 * Components change the graphics state freely while drawing (task-list
 * checkboxes set the draw color and line width, code spans set the fill
 * color, ...), so restoring here keeps whatever the caller had configured
 * intact for anything they draw afterwards.
 */
export const withSavedDocState = <T>(doc: jsPDF, fn: () => T): T => {
    const savedFont = doc.getFont();
    const savedSize = doc.getFontSize();
    const savedColor = doc.getTextColor();
    const savedFillColor = doc.getFillColor();
    const savedDrawColor = doc.getDrawColor();
    const savedLineWidth = doc.getLineWidth();
    try {
        return fn();
    } finally {
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedSize);
        doc.setTextColor(savedColor);
        // Only touch the graphics state when it actually changed, so renders
        // that leave it alone emit no extra PDF operators.
        if (doc.getFillColor() !== savedFillColor) {
            doc.setFillColor(savedFillColor);
        }
        if (doc.getDrawColor() !== savedDrawColor) {
            doc.setDrawColor(savedDrawColor);
        }
        if (doc.getLineWidth() !== savedLineWidth) {
            doc.setLineWidth(savedLineWidth);
        }
    }
};
