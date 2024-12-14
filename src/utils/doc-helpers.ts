import jsPDF from 'jspdf';
import { RenderOption } from '../types';

export const getCharHight = (doc: jsPDF, options: RenderOption): number => {
    return doc.getTextDimensions('H').h * options.page.defaultLineHeightFactor;
};
