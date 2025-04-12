import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { Cursor, RenderOption } from '../../types/renderOption';
import { getCharHight } from '../../utils/doc-helpers';

/**
 * Renders inline text elements (Strong, Em, and Text) with proper inline styling.
 */
const renderInlineText = (
    doc: jsPDF,
    element: ParsedElement,
    cursor: Cursor,
    indent: number,
    options: RenderOption,
): Cursor => {
    // Save current font settings
    const currentFont = doc.getFont().fontName;
    const currentFontStyle = doc.getFont().fontStyle;
    const currentFontSize = doc.getFontSize();

    const spaceMultiplier = (
        style: 'normal' | 'bold' | 'italic' | 'bolditalic',
    ): number => {
        switch (style) {
            case 'normal':
                return 0;
            case 'bold':
                return 1;
            case 'italic':
                return 1.5;
            case 'bolditalic':
                return 2.5;
            default:
                return 0;
        }
    };

    // Helper function to render text with a specific style and update cursor
    const renderTextWithStyle = (
        text: string,
        style: 'normal' | 'bold' | 'italic' | 'bolditalic',
    ) => {
        // Set font style
        if (style === 'bold') {
            doc.setFont(
                options.font.bold.name && options.font.bold.name !== ''
                    ? options.font.bold.name
                    : currentFont,
                options.font.bold.style || 'bold',
            );
        } else if (style === 'italic') {
            doc.setFont(options.font.regular.name, 'italic');
        } else if (style === 'bolditalic') {
            doc.setFont(
                options.font.bold.name && options.font.bold.name !== ''
                    ? options.font.bold.name
                    : currentFont,
                'bolditalic',
            );
        } else {
            doc.setFont(options.font.regular.name, currentFontStyle);
        }

        const textWidth = doc.getTextWidth(text);
        // Check for line break
        if (
            cursor.x + textWidth >
            options.page.xpading + options.page.maxContentWidth
        ) {
            cursor.x = options.page.xpading;
            cursor.y += getCharHight(doc, options);
        }
        const spaceWidth = doc.getTextWidth(' ');
        doc.text(text, cursor.x + indent, cursor.y, { baseline: 'top' });
        cursor.x +=
            textWidth + (spaceWidth * spaceMultiplier(style)) + (style === 'normal'? indent*.7 : 0);
    };

    // Handle the element based on its type
    if (element.type === 'text' && element.items && element.items.length > 0) {
        // Process nested items (e.g., em, strong, text) inline
        for (const item of element.items) {
            if (item.type === 'em' || item.type === 'strong') {
                const baseStyle = item.type === 'em' ? 'italic' : 'bold';
                if (item.items && item.items.length > 0) {
                    // Handle nested emphasis (e.g., ***Bold and Italic***)
                    for (const subItem of item.items) {
                        if (
                            subItem.type === 'strong' &&
                            baseStyle === 'italic'
                        ) {
                            renderTextWithStyle(
                                subItem.content || '',
                                'bolditalic',
                            );
                        } else if (
                            subItem.type === 'em' &&
                            baseStyle === 'bold'
                        ) {
                            renderTextWithStyle(
                                subItem.content || '',
                                'bolditalic',
                            );
                        } else {
                            renderTextWithStyle(
                                subItem.content || '',
                                baseStyle,
                            );
                        }
                    }
                } else {
                    renderTextWithStyle(item.content || '', baseStyle);
                }
            } else {
                // Regular text
                renderTextWithStyle(item.content || '', 'normal');
            }
        }
    } else if (element.type === 'em') {
        renderTextWithStyle(element.content || '', 'italic');
    } else if (element.type === 'strong') {
        renderTextWithStyle(element.content || '', 'bold');
    } else {
        renderTextWithStyle(element.content || '', 'normal');
    }

    // Restore original font settings
    doc.setFont(currentFont, currentFontStyle);
    doc.setFontSize(currentFontSize);

    return cursor;
};

export default renderInlineText;
