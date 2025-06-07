import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { getCharHight } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';

const renderList = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
        start?: number,
        ordered?: boolean,
    ) => void,
) => {
    doc.setFontSize(RenderStore.options.page.defaultFontSize);
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
        RenderStore.updateY(
            getCharHight(doc, RenderStore.options) * 0.2,
            'add',
        ); // Recursively render nested list items
    }
};

export default renderList;
