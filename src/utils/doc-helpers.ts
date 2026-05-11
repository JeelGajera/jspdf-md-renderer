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
