import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderOption } from '../../types/renderOption';

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
): number => {
    const size = 3 - (element?.depth ?? 0) > 0 ? 3 - (element?.depth ?? 0) : 0;
    // doc.setFont(options.font.regular.name, options.font.regular.style);
    doc.setFontSize(options.page.defaultFontSize + size);
    doc.text(element?.content ?? '', x + indent, y, {
        align: 'left',
        maxWidth: options.page.maxContentWidth - indent,
    });
    y += 1.5 * options.page.lineSpace;
    // doc.setFont(options.font.light.name, options.font.light.style);
    doc.setFontSize(options.page.defaultFontSize);
    return y;
};

export default renderHeading;
