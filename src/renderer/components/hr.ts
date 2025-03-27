import jsPDF from 'jspdf';
import { Cursor, RenderOption } from '../../types';
import { getCharHight } from '../../utils/doc-helpers';

const renderHR = (doc: jsPDF, cursor:Cursor, options: RenderOption) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.1);
    doc.line(options.page.xpading, cursor.y, pageWidth - options.page.xpading, cursor.y);
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([], 0);
    cursor.y += getCharHight(doc, options);
    return cursor
};
export default renderHR;
