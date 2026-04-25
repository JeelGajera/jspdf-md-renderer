import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderStore } from '../../store/renderStore';
import { getCharHight } from '../../utils/doc-helpers';
import { JustifiedTextRenderer } from '../../utils/justifiedTextRenderer';

/**
 * Renders heading elements.
 */
const renderHeading = (
    doc: jsPDF,
    element: ParsedElement,
    indent: number,
    store: RenderStore,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        store: RenderStore,
        hasRawBullet?: boolean,
    ) => void,
) => {
    const size = 6 - (element?.depth ?? 0) > 0 ? 6 - (element?.depth ?? 0) : 1;
    doc.setFontSize(store.options.page.defaultFontSize + size);

    if (element?.items && element?.items.length > 0) {
        // Use JustifiedTextRenderer to render mixed styled items correctly
        // We temporarily override the defaultLineHeightFactor to 1.0 to match the 
        // ultra-tight spacing of unstyled headings.
        const originalLineHeightFactor = store.options.page.defaultLineHeightFactor;
        store.options.page.defaultLineHeightFactor = 1.0;

        JustifiedTextRenderer.renderStyledParagraph(
            doc,
            element.items,
            store.X + indent,
            store.Y,
            store.options.page.maxContentWidth - indent,
            store,
            'left'
        );

        // Restore original line height factor
        store.options.page.defaultLineHeightFactor = originalLineHeightFactor;
    } else {
        const charHeight = getCharHight(doc);
        doc.text(element?.content ?? '', store.X + indent, store.Y, {
            align: 'left',
            maxWidth: store.options.page.maxContentWidth - indent,
            baseline: 'top',
        });

        // Record visual bottom and then advance by exactly charHeight (ultra-tight)
        // This ensures minimal gap before the next element
        store.recordContentY(store.Y + charHeight);
        store.updateY(getCharHight(doc), 'add');
    }
    // Reset font size to default after heading
    doc.setFontSize(store.options.page.defaultFontSize);
    store.updateX(store.options.page.xpading, 'set');
};

export default renderHeading;
