import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ParsedElement } from '../../types';
import { RenderStore } from '../../store/renderStore';

const renderTable = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
) => {
    if (!element.header || !element.rows) {
        return;
    }

    const options = RenderStore.options;
    const marginLeft = options.page.xmargin + indentLevel * options.page.indent;

    // Prepare data
    const head = [element.header.map((h) => h.content || '')];
    const body = element.rows.map((row) =>
        row.map((cell) => cell.content || ''),
    );

    // User options
    const userTableOptions = options.table || {};

    autoTable(doc, {
        head: head,
        body: body,
        startY: RenderStore.Y,
        margin: { left: marginLeft, right: options.page.xmargin },
        ...userTableOptions,
        didDrawPage: (data) => {
            if (userTableOptions.didDrawPage) {
                userTableOptions.didDrawPage(data);
            }
        },
        didDrawCell: (data) => {
            if (userTableOptions.didDrawCell) {
                userTableOptions.didDrawCell(data);
            }
            // update Y cursor
            RenderStore.setCursor({
                x: RenderStore.X,
                y: data.cell.y + 2 * options.page.lineSpace,
            });
        },
    });
};

export default renderTable;
