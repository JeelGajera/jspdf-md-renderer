import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { getCharHight, getCharWidth } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';

/**
 * Renders link elements with proper styling and URL handling.
 * Links are rendered in blue color and underlined to distinguish them from regular text.
 */
const renderLink = (
    doc: jsPDF,
    element: ParsedElement,
    indent: number,
    store: RenderStore,
) => {
    // Save current settings
    const currentFont = doc.getFont().fontName;
    const currentFontStyle = doc.getFont().fontStyle;
    const currentFontSize = doc.getFontSize();
    const currentTextColor = doc.getTextColor();

    // Set link styling
    const linkColor = store.options.link?.linkColor || [0, 0, 255]; // Default to blue

    // Set text color to blue
    doc.setTextColor(...linkColor);

    // Calculate available width for text
    const availableWidth =
        store.options.page.maxContentWidth - indent - store.X;

    // Get link text and URL
    const linkText = element.text || element.content || '';
    const linkUrl = element.href || '';

    // Split text into lines
    const textLines = doc.splitTextToSize(linkText, availableWidth);

    if (store.isInlineLockActive) {
        // Inline lock: always render inline, only break if width exceeded
        for (let i = 0; i < textLines.length; i++) {
            const textWidth = doc.getTextDimensions(textLines[i]).w;
            const textHeight = getCharHight(doc) / 2;

            // Add link annotation
            doc.link(store.X + indent, store.Y, textWidth, textHeight, {
                url: linkUrl,
            });

            // Render text
            doc.text(textLines[i], store.X + indent, store.Y, {
                baseline: 'top',
                maxWidth: availableWidth,
            });

            store.updateX(textWidth + 1, 'add');
            // if x exceeds max width, move to next line
            if (
                store.X + textWidth >
                store.options.page.maxContentWidth - indent
            ) {
                store.updateY(textHeight, 'add');
                store.updateX(store.options.page.xpading + indent, 'set');
            }
            if (i < textLines.length - 1) {
                store.updateY(textHeight, 'add');
                store.updateX(store.options.page.xpading + indent, 'set');
            }
        }
    } else {
        // Handle multi-line links
        if (textLines.length > 1) {
            const firstLine = textLines[0];
            const restContent = textLines?.slice(1)?.join(' ');
            const firstLineWidth = doc.getTextDimensions(firstLine).w;
            const textHeight = getCharHight(doc) / 2;

            // Add link annotation for first line
            doc.link(store.X + indent, store.Y, firstLineWidth, textHeight, {
                url: linkUrl,
            });

            // Render first line
            doc.text(firstLine, store.X + indent, store.Y, {
                baseline: 'top',
                maxWidth: availableWidth,
            });

            store.updateX(store.options.page.xpading + indent);
            store.updateY(textHeight, 'add');

            const maxWidthForRest =
                store.options.page.maxContentWidth -
                indent -
                store.options.page.xpading;
            const restLines = doc.splitTextToSize(restContent, maxWidthForRest);

            restLines.forEach((line: string) => {
                const lineWidth = doc.getTextDimensions(line).w;

                // Add link annotation for each line
                doc.link(
                    store.X + getCharWidth(doc),
                    store.Y,
                    lineWidth,
                    textHeight,
                    { url: linkUrl },
                );

                // Render line
                doc.text(line, store.X + getCharWidth(doc), store.Y, {
                    baseline: 'top',
                    maxWidth: maxWidthForRest,
                });
            });
        } else {
            const textWidth = doc.getTextDimensions(linkText).w;
            const textHeight = getCharHight(doc) / 2;

            // Add link annotation
            doc.link(store.X + indent, store.Y, textWidth, textHeight, {
                url: linkUrl,
            });

            // Render text
            doc.text(linkText, store.X + indent, store.Y, {
                baseline: 'top',
                maxWidth: availableWidth,
            });

            store.updateX(textWidth + 2, 'add');
        }
    }

    // Restore original settings
    doc.setFont(currentFont, currentFontStyle);
    doc.setFontSize(currentFontSize);
    doc.setTextColor(currentTextColor);
};

export default renderLink;
