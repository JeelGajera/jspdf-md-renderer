import { getCharHight } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';
import { breakIfOverflow } from '../../utils/handlePageBreak';

const renderHR = (doc: jsPDF, store: RenderStore) => {
    const savedDrawColor = doc.getDrawColor();
    const savedLineWidth = doc.getLineWidth();
    breakIfOverflow(doc, store, getCharHight(doc));
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.1);
    doc.line(
        store.options.page.xpading,
        store.Y,
        pageWidth - store.options.page.xpading,
        store.Y,
    );
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([], 0);
    store.updateY(getCharHight(doc), 'add');
    store.updateY(store.options.spacing?.afterHR ?? 2, 'add');
    doc.setDrawColor(savedDrawColor);
    doc.setLineWidth(savedLineWidth);
};
export default renderHR;
