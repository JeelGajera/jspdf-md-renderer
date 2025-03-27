import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { Cursor, RenderOption } from '../../types/renderOption';
import { getCharHight } from '../../utils/doc-helpers';

/**
 * Renders heading elements.
 */
const renderHeading = (
    doc: jsPDF,
    element: ParsedElement,
    cursor: Cursor,
    indent: number,
    options: RenderOption,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => Cursor,
): Cursor => {
    const size = 6 - (element?.depth ?? 0) > 0 ? 6 - (element?.depth ?? 0) : 0;
    // doc.setFont(options.font.regular.name, options.font.regular.style);
    doc.setFontSize(options.page.defaultFontSize + size);
    if (element?.items && element?.items.length > 0) {
        for (const item of element?.items ?? []) {
            cursor = parentElementRenderer(item, indent, false);
        }
    } else {
        doc.text(element?.content ?? '', cursor.x + indent, cursor.y, {
            align: 'left',
            maxWidth: options.page.maxContentWidth - indent,
        });
        cursor.y += 1.5 * getCharHight(doc, options);
    }

    // doc.setFont(options.font.light.name, options.font.light.style);
    doc.setFontSize(options.page.defaultFontSize);
    return cursor;
};

export default renderHeading;
