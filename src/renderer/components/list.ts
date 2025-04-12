import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { Cursor, RenderOption } from '../../types/renderOption';
import { getCharHight } from '../../utils/doc-helpers';

const renderList = (
    doc: jsPDF,
    element: ParsedElement,
    cursor: Cursor,
    indentLevel: number,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
        start?: number,
        ordered?: boolean,
    ) => Cursor,
): Cursor => {
    doc.setFontSize(options.page.defaultFontSize);
    // doc.setFont(options.font.light.name, options.font.light.style);
    for (const [i, point] of element?.items?.entries() ?? []) {
        const _start = element.ordered
            ? (element.start ?? 0) + i
            : element.start;
        cursor = parentElementRenderer(
            point,
            indentLevel + 1,
            true,
            _start,
            element.ordered,
        );
        cursor.y += getCharHight(doc, options) * 0.2; // Recursively render nested list items
    }
    return cursor;
};

export default renderList;
