import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { Cursor, RenderOption } from '../../types/renderOption';
import { justifyText } from '../../utils/justifyText';
import { getCharHight } from '../../utils/doc-helpers';

/**
 * Renders inline text elements (Strong and Em)
 */
const renderInlineText = (
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
    // Save current font settings
    const currentFont = doc.getFont().fontName;
    const currentFontStyle = doc.getFont().fontStyle;
    const currentFontSize = doc.getFontSize();

    // Set appropriate font style based on element type
    if (element.type === 'strong') {
        if (options.font.bold.name && options.font.bold.name !== '') {
            doc.setFont(options.font.bold.name, options.font.bold.style);
        } else {
            // If no bold font specified, use regular font with bold style
            doc.setFont(currentFont, 'bold');
        }
    } else if (element.type === 'em') {
        doc.setFont(options.font.regular.name, 'italic');
    }

    if (element?.items && element?.items.length > 0) {
        for (const item of element?.items ?? []) {
            cursor = parentElementRenderer(item, indent, false);
        }
    } else {
        cursor.y =
            justifyText(
                doc,
                element.content ?? '',
                cursor.x + indent,
                cursor.y,
                options.page.maxContentWidth - indent,
                options.page.defaultLineHeightFactor,
            ) + getCharHight(doc, options);
    }

    // Restore original font settings
    doc.setFont(currentFont, currentFontStyle);
    doc.setFontSize(currentFontSize);

    return cursor;
};

export default renderInlineText;
