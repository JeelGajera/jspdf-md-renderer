import jsPDF from 'jspdf';
import { getCharHight } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';
import { breakIfOverflow } from '../../utils/handlePageBreak';

const renderHR = (doc: jsPDF, store: RenderStore) => {
    const savedDrawColor = doc.getDrawColor();
    const savedLineWidth = doc.getLineWidth();
    breakIfOverflow(doc, store, getCharHight(doc));
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.1);
    // Span the content column, not the physical page. Deriving the right edge
    // from pageSize made the rule ignore maxContentWidth entirely: with
    // maxContentWidth 100 the rule still ran the full 190 to the page margin.
    const left = store.options.page.xpading;
    doc.line(left, store.Y, left + store.options.page.maxContentWidth, store.Y);
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([], 0);
    store.updateY(getCharHight(doc), 'add');
    store.updateY(store.options.spacing?.afterHR ?? 2, 'add');
    doc.setDrawColor(savedDrawColor);
    doc.setLineWidth(savedLineWidth);
};
export default renderHR;
