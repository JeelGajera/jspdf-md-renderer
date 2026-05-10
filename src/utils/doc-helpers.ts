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
