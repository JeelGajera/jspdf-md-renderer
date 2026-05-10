import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ParsedElement } from '../../types';
import { RenderStore } from '../../store/renderStore';
import { ensureSpace } from '../../utils/handlePageBreak';

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
    store: RenderStore,
) => {
    // Guard: must have header and at least structure
    if (!element.header || element.header.length === 0) {
        console.warn('[jspdf-md-renderer] Table skipped: no header row');
        return;
    }

    const options = store.options;
    const marginLeft = options.page.xmargin + indentLevel * options.page.indent;

    // Estimate table header height at minimum
    ensureSpace(doc, store, 20);

    // Guard: normalize rows
    const columnCount = element.header.length;
    const rows = (element.rows ?? []).map((row) => {
        // Ensure each row has the same number of cells as the header
        const normalized = [...row];
        while (normalized.length < columnCount) {
            normalized.push({ type: 'table_cell', content: '' });
        }
        return normalized
            .slice(0, columnCount)
            .map((cell) => cell.content || '');
    });

    const head = [element.header.map((h) => h.content || '')];

    // User options
    const userTableOptions = options.table || {};

    // Safe callback merging
    const safeDidDrawPage = (data: unknown) => {
        try {
            if (userTableOptions.didDrawPage) {
                userTableOptions.didDrawPage(data as never);
            }
        } catch (e) {
            console.warn(
                '[jspdf-md-renderer] table.didDrawPage callback threw:',
                e,
            );
        }
    };
    const safeDidDrawCell = (data: unknown) => {
        try {
            if (userTableOptions.didDrawCell) {
                userTableOptions.didDrawCell(data as never);
            }
        } catch (e) {
            console.warn(
                '[jspdf-md-renderer] table.didDrawCell callback threw:',
                e,
            );
        }
    };

    resolveAutoTable()(doc, {
        head,
        body: rows,
        startY: store.Y,
        margin: { left: marginLeft, right: options.page.xmargin },
        ...userTableOptions,
        didDrawPage: safeDidDrawPage,
        didDrawCell: safeDidDrawCell,
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } })
        .lastAutoTable?.finalY;
    if (typeof finalY === 'number') {
        store.updateY(finalY + (options.spacing?.afterTable ?? 3), 'set');
        store.updateX(options.page.xpading, 'set');
        store.recordContentY();
    } else {
        console.warn(
            '[jspdf-md-renderer] autoTable did not return a finalY. Y position may be incorrect.',
        );
    }
};

export default renderTable;
