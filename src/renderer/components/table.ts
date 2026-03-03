import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ParsedElement } from '../../types';
import { RenderStore } from '../../store/renderStore';

type AutoTableFn = typeof autoTable;

const resolveAutoTable = (): AutoTableFn => {
    const autoTableCandidate = autoTable as unknown as {
        default?: AutoTableFn;
        autoTable?: AutoTableFn;
    };

    if (typeof autoTable === 'function') {
        return autoTable;
    }

    if (typeof autoTableCandidate.default === 'function') {
        return autoTableCandidate.default;
    }

    if (typeof autoTableCandidate.autoTable === 'function') {
        return autoTableCandidate.autoTable;
    }

    throw new Error(
        'Could not resolve jspdf-autotable export. Expected a callable export.',
    );
};

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

    resolveAutoTable()(doc, {
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
                y: data.cell.y + data.cell.height + 2 * options.page.lineSpace,
            });
        },
    });
};

export default renderTable;
