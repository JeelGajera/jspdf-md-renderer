import jsPDF from 'jspdf';
import { RenderOption } from '../types';

/**
 * Handles page breaks when content overflows.
 */
export const HandlePageBreaks = (doc: jsPDF, options: RenderOption) => {
    if (typeof options.pageBreakHandler === 'function') {
        options.pageBreakHandler();
    } else {
        doc.addPage(options.page?.format,options.page?.orientation)
    }
};
