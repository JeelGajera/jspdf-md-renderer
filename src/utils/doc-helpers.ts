import jsPDF from 'jspdf';
import { RenderStore } from '../store/renderStore';

export const getCharHight = (doc: jsPDF): number => {
    return doc.getTextDimensions('H').h * RenderStore.options.page.defaultLineHeightFactor;
};

export const getCharWidth = (doc: jsPDF): number => {
    return doc.getTextDimensions('H').w * RenderStore.options.page.defaultLineHeightFactor;
};
