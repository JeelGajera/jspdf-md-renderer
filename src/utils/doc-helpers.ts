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
 * Saves the current jsPDF font, size, and text color, executes `fn`,
 * then restores those properties — even if `fn` throws.
 */
export const withSavedDocState = <T>(doc: jsPDF, fn: () => T): T => {
    const savedFont = doc.getFont();
    const savedSize = doc.getFontSize();
    const savedColor = doc.getTextColor();
    try {
        return fn();
    } finally {
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedSize);
        doc.setTextColor(savedColor);
    }
};

/**
 * Saves the current jsPDF fill color, draw color and line width, executes
 * `fn`, then restores those graphics-state properties — even if `fn`
 * throws.
 *
 * Unlike `withSavedDocState`, the font, size and text color are left where
 * the render leaves them: issue #75 is only about the graphics state, and
 * callers rely on the doc being in the body font at the body size
 * afterwards (e.g. footers drawn with `doc.text()`).
 */
export const withSavedGraphicsState = <T>(doc: jsPDF, fn: () => T): T => {
    const savedFillColor = doc.getFillColor();
    const savedDrawColor = doc.getDrawColor();
    const savedLineWidth = doc.getLineWidth();
    try {
        return fn();
    } finally {
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
