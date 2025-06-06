import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';
import { getCharHight } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';

const renderList = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
        start?: number,
        ordered?: boolean,
    ) => void,
) => {
    doc.setFontSize(options.page.defaultFontSize);
    // doc.setFont(options.font.light.name, options.font.light.style);
    for (const [i, point] of element?.items?.entries() ?? []) {
        const _start = element.ordered
            ? (element.start ?? 0) + i
            : element.start;
        parentElementRenderer(
            point,
            indentLevel + 1,
            true,
            _start,
            element.ordered,
        );
        RenderStore.updateY(getCharHight(doc, options) * 0.2); // Recursively render nested list items
    }
};

export default renderList;
