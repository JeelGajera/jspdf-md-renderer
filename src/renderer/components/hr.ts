import jsPDF from 'jspdf';
import { RenderOption } from '../../types';
import { getCharHight } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';

const renderHR = (doc: jsPDF, options: RenderOption) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.1);
    doc.line(
        options.page.xpading,
        RenderStore.Y,
        pageWidth - options.page.xpading,
        RenderStore.Y,
    );
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([], 0);
    RenderStore.updateY(getCharHight(doc, options), 'add');
};
export default renderHR;
