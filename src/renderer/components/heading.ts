import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';
import { getCharHight } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';

/**
 * Renders heading elements.
 */
const renderHeading = (
    doc: jsPDF,
    element: ParsedElement,
    indent: number,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => void,
) => {
    const size = 6 - (element?.depth ?? 0) > 0 ? 6 - (element?.depth ?? 0) : 0;
    doc.setFontSize(options.page.defaultFontSize + size);
    if (element?.items && element?.items.length > 0) {
        for (const item of element?.items ?? []) {
            parentElementRenderer(item, indent, false);
        }
    } else {
        doc.text(element?.content ?? '', RenderStore.X + indent, RenderStore.Y, {
            align: 'left',
            maxWidth: options.page.maxContentWidth - indent,
        });
        RenderStore.updateY(1.5 * getCharHight(doc, options), 'add');
    }
    // Reset font size to default after heading
    doc.setFontSize(options.page.defaultFontSize);
    // Move cursor to the next line after heading
    RenderStore.updateY((4 - (element?.depth ?? 1)) * getCharHight(doc, options), 'add');
    RenderStore.updateX(options.page.xpading)
};

export default renderHeading;
