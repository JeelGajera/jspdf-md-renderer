import jsPDF from 'jspdf';
import { RenderStore } from '../store/renderStore';

export const HandlePageBreaks = (doc: jsPDF, store: RenderStore) => {
    if (typeof store.options.pageBreakHandler === 'function') {
        store.options.pageBreakHandler(doc);
    } else {
        doc.addPage(
            store.options.page?.format,
            store.options.page?.orientation,
        );
    }
    // reset cursor positions on new page
    store.updateY(store.options.page.topmargin);
    store.updateX(store.options.page.xpading);
};
