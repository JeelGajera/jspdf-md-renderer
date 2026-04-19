import jsPDF from 'jspdf';

export const getCharHight = (doc: jsPDF): number => {
    return doc.getTextDimensions('H').h;
};

export const getCharWidth = (doc: jsPDF): number => {
    return doc.getTextDimensions('H').w;
};
