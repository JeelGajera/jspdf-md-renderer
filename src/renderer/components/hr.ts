import jsPDF from 'jspdf';
import { getCharHight } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';

const renderHR = (doc: jsPDF) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.1);
    doc.line(
        RenderStore.options.page.xpading,
        RenderStore.Y,
        pageWidth - RenderStore.options.page.xpading,
        RenderStore.Y,
    );
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([], 0);
    RenderStore.updateY(getCharHight(doc, RenderStore.options), 'add');
};
export default renderHR;
