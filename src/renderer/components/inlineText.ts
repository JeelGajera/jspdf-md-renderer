import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { getCharHight, getCharWidth } from '../../utils/doc-helpers';
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
        style: 'normal' | 'bold' | 'italic' | 'bolditalic' | 'codespan',
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
            case 'codespan':
                return 0.5;
            default:
                return 0;
        }
    };

    // Helper function to render text with a specific style and update cursor
    const renderTextWithStyle = (
        text: string,
        style: 'normal' | 'bold' | 'italic' | 'bolditalic' | 'codespan',
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
        } else if (style === 'codespan') {
            doc.setFont('courier', 'normal');
            doc.setFontSize(currentFontSize * 0.9); // Slightly smaller for code
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

        const isCodeSpan = style === 'codespan';
        const codePadding = 1;
        const codeBgColor = '#EEEEEE';

        if (RenderStore.isInlineLockActive) {
            // Inline lock: always render inline, only break if width exceeded
            for (let i = 0; i < textLines.length; i++) {
                if (isCodeSpan) {
                    const lineWidth =
                        doc.getTextWidth(textLines[i]) + getCharWidth(doc);
                    const lineHeight = getCharHight(doc); // This is approx cap height

                    doc.setFillColor(codeBgColor);
                    // Draw rect slightly larger
                    doc.roundedRect(
                        RenderStore.X + indent - codePadding,
                        RenderStore.Y - codePadding,
                        lineWidth + codePadding * 2,
                        lineHeight + codePadding * 2,
                        2,
                        2,
                        'F',
                    );
                    doc.setFillColor('#000000'); // Reset fill
                }

                doc.text(textLines[i], RenderStore.X + indent, RenderStore.Y, {
                    baseline: 'top',
                    maxWidth: availableWidth,
                });
                RenderStore.updateX(
                    doc.getTextDimensions(textLines[i]).w +
                        (isCodeSpan ? codePadding * 2 : 1),
                    'add',
                );
                if (i < textLines.length - 1) {
                    RenderStore.updateY(getCharHight(doc), 'add');
                    RenderStore.updateX(
                        RenderStore.options.page.xpading,
                        'set',
                    );
                }
            }
        } else {
            if (textLines.length > 1) {
                const firstLine = textLines[0];
                const restContent = textLines?.slice(1)?.join(' ');

                if (isCodeSpan) {
                    // Draw bg for first line
                    const w = doc.getTextWidth(firstLine) + getCharWidth(doc);
                    const h = getCharHight(doc);
                    doc.setFillColor(codeBgColor);
                    doc.roundedRect(
                        RenderStore.X +
                            (indent >= 2 ? indent + 2 : 0) -
                            codePadding,
                        RenderStore.Y - codePadding,
                        w + codePadding * 2,
                        h + codePadding * 2,
                        2,
                        2,
                        'F',
                    );
                    doc.setFillColor('#000000');
                }

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

                // Rest lines
                const maxWidthForRest =
                    RenderStore.options.page.maxContentWidth -
                    indent -
                    RenderStore.options.page.xpading;
                const restLines = doc.splitTextToSize(
                    restContent,
                    maxWidthForRest,
                );
                restLines.forEach((line: string) => {
                    if (isCodeSpan) {
                        const w = doc.getTextWidth(line) + getCharWidth(doc);
                        const h = getCharHight(doc);
                        doc.setFillColor(codeBgColor);
                        doc.roundedRect(
                            RenderStore.X + getCharWidth(doc) - codePadding,
                            RenderStore.Y - codePadding,
                            w + codePadding * 2,
                            h + codePadding * 2,
                            2,
                            2,
                            'F',
                        );
                        doc.setFillColor('#000000');
                    }

                    doc.text(
                        line,
                        RenderStore.X + getCharWidth(doc),
                        RenderStore.Y,
                        {
                            baseline: 'top',
                            maxWidth: maxWidthForRest,
                        },
                    );
                });
            } else {
                if (isCodeSpan) {
                    const w = doc.getTextWidth(text) + getCharWidth(doc);
                    const h = getCharHight(doc);
                    doc.setFillColor(codeBgColor);
                    doc.roundedRect(
                        RenderStore.X + indent - codePadding,
                        RenderStore.Y - codePadding,
                        w + codePadding * 2,
                        h + codePadding * 2,
                        2,
                        2,
                        'F',
                    );
                    doc.setFillColor('#000000');
                }

                doc.text(text, RenderStore.X + indent, RenderStore.Y, {
                    baseline: 'top',
                    maxWidth: availableWidth,
                });
                RenderStore.updateX(
                    doc.getTextDimensions(text).w +
                        (indent >= 2 ? text.split(' ').length + 2 : 2) *
                            spaceMultiplier(style) *
                            0.5 +
                        (isCodeSpan ? codePadding * 2 : 0),
                    'add',
                );
            }
        }
    };

    // Handle the element based on its type
    if (element.type === 'text' && element.items && element.items.length > 0) {
        for (const item of element.items) {
            if (item.type === 'codespan') {
                renderTextWithStyle(item.content || '', 'codespan');
            } else if (item.type === 'em' || item.type === 'strong') {
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
    } else if (element.type === 'codespan') {
        renderTextWithStyle(element.content || '', 'codespan');
    } else {
        renderTextWithStyle(element.content || '', 'normal');
    }

    doc.setFont(currentFont, currentFontStyle);
    doc.setFontSize(currentFontSize);
};

export default renderInlineText;
