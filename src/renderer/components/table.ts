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

/**
 * Flattens a cell's inline tokens to plain text.
 *
 * autoTable draws cell content itself and has no notion of mixed inline runs,
 * so emphasis cannot be reproduced faithfully here. Previously the cell's raw
 * markdown source was passed straight through and readers saw literal `**bold**`
 * and `[label](url)` in the output. Rendering the text without its markup is a
 * strictly better approximation; full inline styling inside cells needs a
 * custom cell renderer and is tracked for a later release.
 */
const cellToText = (cell: ParsedElement): string => {
    const fromTokens = (nodes: ParsedElement[] | undefined): string =>
        (nodes ?? [])
            .map((node) => {
                if (node.items && node.items.length > 0) {
                    return fromTokens(node.items);
                }
                if (node.type === 'br') return ' ';
                return node.content ?? node.text ?? '';
            })
            .join('');

    const text = fromTokens(cell.items);
    return (text || cell.content || '').trim();
};

const renderTable = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    store: RenderStore,
) => {
    // Guard: must have header and at least structure
    if (!element.header || element.header.length === 0) {
        store.warn({
            code: 'TABLE_SKIPPED',
            message: 'Table skipped because it has no header row',
            droppedNodes: 1,
        });
        return;
    }

    const options = store.options;
    const indent = indentLevel * options.page.indent;
    const marginLeft = options.page.xpading + indent;
    const availableWidth = Math.max(10, options.page.maxContentWidth - indent);

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
        return normalized.slice(0, columnCount).map(cellToText);
    });

    const head = [element.header.map(cellToText)];

    // Column alignment from the markdown delimiter row (`|:--|--:|`). It was
    // parsed by marked but never read, so every column rendered left-aligned.
    const columnStyles: Record<
        number,
        { halign: 'left' | 'center' | 'right' }
    > = {};
    (element.columnAlign ?? []).forEach((align, index) => {
        if (align === 'center' || align === 'right' || align === 'left') {
            columnStyles[index] = { halign: align };
        }
    });

    // User options
    const userTableOptions = options.table || {};

    // Safe callback merging
    const safeDidDrawPage = (data: unknown) => {
        try {
            if (userTableOptions.didDrawPage) {
                userTableOptions.didDrawPage(data as never);
            }
        } catch (e) {
            store.warn({
                code: 'TABLE_CALLBACK_FAILED',
                message: `table.didDrawPage callback threw: ${String(e)}`,
                context: 'didDrawPage',
            });
        }
    };
    const safeDidDrawCell = (data: unknown) => {
        try {
            if (userTableOptions.didDrawCell) {
                userTableOptions.didDrawCell(data as never);
            }
        } catch (e) {
            store.warn({
                code: 'TABLE_CALLBACK_FAILED',
                message: `table.didDrawCell callback threw: ${String(e)}`,
                context: 'didDrawCell',
            });
        }
    };

    resolveAutoTable()(doc, {
        head,
        body: rows,
        startY: store.Y,
        ...(Object.keys(columnStyles).length > 0 ? { columnStyles } : {}),
        margin: {
            left: marginLeft,
            right: Math.max(
                0,
                doc.internal.pageSize.getWidth() -
                    (marginLeft + availableWidth),
            ),
        },
        tableWidth: availableWidth,
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
        store.warn({
            code: 'TABLE_POSITION_UNKNOWN',
            message:
                'autoTable did not report a finalY, so content after this ' +
                'table may be positioned incorrectly',
        });
    }
};

export default renderTable;
