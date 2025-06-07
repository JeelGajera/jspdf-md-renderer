import jsPDF from 'jspdf';
import { RenderOption } from '../types';
import { RenderStore } from '../store/renderStore';

/**
 * Handles page breaks when content overflows.
 */
export const HandlePageBreaks = (doc: jsPDF, options: RenderOption) => {
    if (typeof options.pageBreakHandler === 'function') {
        options.pageBreakHandler();
    } else {
        doc.addPage(options.page?.format, options.page?.orientation);
    }
    // reset cursor positions on new page
    RenderStore.updateY(RenderStore.options.page.topmargin);
    RenderStore.updateX(RenderStore.options.page.xpading);
};
