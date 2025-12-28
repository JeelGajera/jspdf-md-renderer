import jsPDF from 'jspdf';
import { RenderStore } from '../store/renderStore';

/**
 * Handles page breaks when content overflows.
 */
export const HandlePageBreaks = (doc: jsPDF) => {
    if (typeof RenderStore.options.pageBreakHandler === 'function') {
        RenderStore.options.pageBreakHandler(doc);
    } else {
        doc.addPage(
            RenderStore.options.page?.format,
            RenderStore.options.page?.orientation,
        );
    }
    // reset cursor positions on new page
    RenderStore.updateY(RenderStore.options.page.topmargin);
    RenderStore.updateX(RenderStore.options.page.xpading);
};
