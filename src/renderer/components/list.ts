import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';
import { getCharHight } from '../../utils/doc-helpers';

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
    ) => number,
): number => {
    doc.setFontSize(options.page.defaultFontSize);
    // doc.setFont(options.font.light.name, options.font.light.style);
    for (const point of element?.items ?? []) {
        y =
            parentElementRenderer(point, indentLevel + 1, true) +
            getCharHight(doc, options) * 0.2; // Recursively render nested list items
    }
    return y;
};

export default renderList;
