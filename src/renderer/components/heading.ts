import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';
import { getCharHight } from '../../utils/doc-helpers';

/**
 * Renders heading elements.
 */
const renderHeading = (
    doc: jsPDF,
    element: ParsedElement,
    x: number,
    y: number,
    indent: number,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => number,
): number => {
    const size = 6 - (element?.depth ?? 0) > 0 ? 6 - (element?.depth ?? 0) : 0;
    // doc.setFont(options.font.regular.name, options.font.regular.style);
    doc.setFontSize(options.page.defaultFontSize + size);
    if (element?.items && element?.items.length > 0) {
        for (const item of element?.items ?? []) {
            y = parentElementRenderer(item, indent, false);
        }
    } else {
        doc.text(element?.content ?? '', x + indent, y, {
            align: 'left',
            maxWidth: options.page.maxContentWidth - indent,
        });
        y += 1.5 * getCharHight(doc, options);
    }

    // doc.setFont(options.font.light.name, options.font.light.style);
    doc.setFontSize(options.page.defaultFontSize);
    return y;
};

export default renderHeading;
