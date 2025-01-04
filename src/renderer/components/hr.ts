import jsPDF from 'jspdf';
import { RenderOption } from '../../types';
import { getCharHight } from '../../utils/doc-helpers';

const renderHR = (doc: jsPDF, y: number, options: RenderOption) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.1);
    doc.line(options.page.xpading, y, pageWidth - options.page.xpading, y);
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([], 0);
    return y + getCharHight(doc, options);
};
export default renderHR;
