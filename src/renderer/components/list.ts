import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';

const renderList = (
    doc: jsPDF,
    element: ParsedElement,
    y: number,
    indentLevel: number,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => void,
): number => {
    doc.setFontSize(options.page.defaultFontSize);
    doc.setFont(options.font.light.name, options.font.light.style);
    for (const point of element?.items ?? []) {
        parentElementRenderer(point, indentLevel + 1, true); // Recursively render nested list items
    }
    y += options.page.lineSpace;
    return y;
};

export default renderList;
