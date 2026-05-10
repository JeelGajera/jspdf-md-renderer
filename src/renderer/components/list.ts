import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderStore } from '../../store/renderStore';

const renderList = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    store: RenderStore,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        store: RenderStore,
        hasRawBullet?: boolean,
        start?: number,
        ordered?: boolean,
    ) => void,
) => {
    doc.setFontSize(store.options.page.defaultFontSize);
    for (const [i, point] of element?.items?.entries() ?? []) {
        const _start = element.ordered ? (element.start ?? 1) + i : undefined;
        parentElementRenderer(
            point,
            indentLevel + 1,
            store,
            true,
            _start,
            element.ordered,
        );
        if (i < (element.items?.length ?? 0) - 1) {
            store.updateY(store.options.spacing?.betweenListItems ?? 0, 'add');
        }
    }
    store.updateY(store.options.spacing?.afterList ?? 3, 'add');
};

export default renderList;
