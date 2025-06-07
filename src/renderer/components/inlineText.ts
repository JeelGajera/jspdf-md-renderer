import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { getCharHight } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';

/**
 * Renders inline text elements (Strong, Em, and Text) with proper inline styling.
 */
const renderInlineText = (
    doc: jsPDF,
    element: ParsedElement,
    indent: number,
) => {
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
                return 1.5;
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
                RenderStore.options.font.bold.name &&
                    RenderStore.options.font.bold.name !== ''
                    ? RenderStore.options.font.bold.name
                    : currentFont,
                RenderStore.options.font.bold.style || 'bold',
            );
        } else if (style === 'italic') {
            doc.setFont(RenderStore.options.font.regular.name, 'italic');
        } else if (style === 'bolditalic') {
            doc.setFont(
                RenderStore.options.font.bold.name &&
                    RenderStore.options.font.bold.name !== ''
                    ? RenderStore.options.font.bold.name
                    : currentFont,
                'bolditalic',
            );
        } else {
            doc.setFont(
                RenderStore.options.font.regular.name,
                currentFontStyle,
            );
        }

        // Calculate available width for text
        const availableWidth =
            RenderStore.options.page.maxContentWidth - indent - RenderStore.X;

        // Split text into lines
        const textLines = doc.splitTextToSize(text, availableWidth);

        if (RenderStore.isInlineLockActive) {
            // Inline lock: always render inline, only break if width exceeded
            for (let i = 0; i < textLines.length; i++) {
                doc.text(
                    textLines[i],
                    RenderStore.X + indent,
                    RenderStore.Y,
                    {
                        baseline: 'top',
                        maxWidth: availableWidth,
                    },
                );
                RenderStore.updateX(
                    doc.getTextDimensions(textLines[i]).w + 1,
                    'add',
                );
                if (i < textLines.length - 1) {
                    RenderStore.updateY(getCharHight(doc), 'add');
                    RenderStore.updateX(RenderStore.options.page.xpading + indent, 'set');
                }
            }
        } else {
            // Original logic
            if (textLines.length > 1) {
                const firstLine = textLines[0];
                const restContent = textLines?.slice(1)?.join(' ');
                doc.text(
                    firstLine,
                    RenderStore.X +
                        (indent >= 2 ? indent + 2 * spaceMultiplier(style) : 0),
                    RenderStore.Y,
                    {
                        baseline: 'top',
                        maxWidth: availableWidth,
                    },
                );
                RenderStore.updateX(RenderStore.options.page.xpading + indent);
                RenderStore.updateY(getCharHight(doc), 'add');
                const maxWidthForRest =
                    RenderStore.options.page.maxContentWidth -
                    indent -
                    RenderStore.options.page.xpading -
                    RenderStore.options.page.xmargin;
                const restLines = doc.splitTextToSize(restContent, maxWidthForRest);
                restLines.forEach((line: string) => {
                    doc.text(line, RenderStore.X + indent, RenderStore.Y, {
                        baseline: 'top',
                        maxWidth: maxWidthForRest,
                    });
                    RenderStore.updateX(RenderStore.options.page.xpading + indent);
                    RenderStore.updateY(
                        getCharHight(doc),
                        'add',
                    );
                });
            } else {
                doc.text(text, RenderStore.X + indent, RenderStore.Y, {
                    baseline: 'top',
                    maxWidth: availableWidth,
                });
                RenderStore.updateX(
                    doc.getTextDimensions(text).w +
                        (indent >= 2 ? text.split(' ').length + 2 : 2) *
                            spaceMultiplier(style),
                    'add',
                );
            }
        }
    };

    // Handle the element based on its type
    if (element.type === 'text' && element.items && element.items.length > 0) {
        for (const item of element.items) {
            if (item.type === 'em' || item.type === 'strong') {
                const baseStyle = item.type === 'em' ? 'italic' : 'bold';
                if (item.items && item.items.length > 0) {
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

    doc.setFont(currentFont, currentFontStyle);
    doc.setFontSize(currentFontSize);
};

export default renderInlineText;
