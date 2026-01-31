import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderStore } from '../../store/renderStore';
import { getCharHight } from '../../utils/doc-helpers';

/**
 * Renders heading elements.
 */
const renderHeading = (
    doc: jsPDF,
    element: ParsedElement,
    indent: number,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => void,
) => {
    const size = 6 - (element?.depth ?? 0) > 0 ? 6 - (element?.depth ?? 0) : 1;
    doc.setFontSize(RenderStore.options.page.defaultFontSize + size);

    if (element?.items && element?.items.length > 0) {
        for (const item of element?.items ?? []) {
            parentElementRenderer(item, indent, false);
        }
    } else {
        const charHeight = getCharHight(doc);
        doc.text(
            element?.content ?? '',
            RenderStore.X + indent,
            RenderStore.Y,
            {
                align: 'left',
                maxWidth: RenderStore.options.page.maxContentWidth - indent,
                baseline: 'top',
            },
        );

        // Record visual bottom and then advance by exactly charHeight (ultra-tight)
        // This ensures minimal gap before the next element
        RenderStore.recordContentY(RenderStore.Y + charHeight);
        RenderStore.updateY(charHeight, 'add');
    }
    // Reset font size to default after heading
    doc.setFontSize(RenderStore.options.page.defaultFontSize);
    RenderStore.updateX(RenderStore.options.page.xpading, 'set');
};

export default renderHeading;
