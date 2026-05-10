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

/**
 * Returns true if adding `height` to the current Y would exceed the page.
 */
export const willOverflow = (store: RenderStore, height: number): boolean => {
    return store.Y + height > store.options.page.maxContentHeight;
};

/**
 * Checks if we will overflow, and if so, breaks the page first.
 * Returns true if a page break was performed.
 */
export const breakIfOverflow = (
    doc: jsPDF,
    store: RenderStore,
    height: number,
): boolean => {
    if (willOverflow(store, height)) {
        HandlePageBreaks(doc, store);
        return true;
    }
    return false;
};

/**
 * Ensures there is at least `minHeight` space remaining on the page.
 * If not, breaks to next page.
 */
export const ensureSpace = (
    doc: jsPDF,
    store: RenderStore,
    minHeight: number,
): void => {
    if (store.options.page.maxContentHeight - store.Y < minHeight) {
        HandlePageBreaks(doc, store);
    }
};
