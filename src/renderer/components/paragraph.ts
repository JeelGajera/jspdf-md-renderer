import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderStore } from '../../store/renderStore';
import { JustifiedTextRenderer } from '../../utils/justifiedTextRenderer';
import { TextRenderer } from '../../utils/text-renderer';

/**
 * Renders paragraph elements with proper text alignment.
 * Handles mixed inline styles (bold, italic, codespan) and links.
 * Respects user's textAlignment option from RenderStore.
 */
const renderParagraph = (
    doc: jsPDF,
    element: ParsedElement,
    indent: number,
    parentElementRenderer: (
        element: ParsedElement,
        indentLevel: number,
        hasRawBullet?: boolean,
    ) => void,
) => {
    RenderStore.activateInlineLock();
    doc.setFontSize(RenderStore.options.page.defaultFontSize);

    const maxWidth = RenderStore.options.page.maxContentWidth - indent;

    if (element?.items && element?.items.length > 0) {
        // Check if there are any non-inline items that need special handling
        const hasNonInlineItems = element.items.some(
            (item) =>
                !['strong', 'em', 'text', 'codespan', 'link'].includes(
                    item.type,
                ),
        );

        if (hasNonInlineItems) {
            // Mixed content: render inline items with JustifiedTextRenderer,
            // delegate non-inline items to parentElementRenderer
            const inlineBuffer: ParsedElement[] = [];

            const flushInlineBuffer = () => {
                if (inlineBuffer.length > 0) {
                    JustifiedTextRenderer.renderStyledParagraph(
                        doc,
                        inlineBuffer,
                        RenderStore.X + indent,
                        RenderStore.Y,
                        maxWidth,
                    );
                    inlineBuffer.length = 0;
                }
            };

            for (const item of element.items) {
                if (
                    ['strong', 'em', 'text', 'codespan', 'link'].includes(
                        item.type,
                    )
                ) {
                    inlineBuffer.push(item);
                } else {
                    flushInlineBuffer();
                    parentElementRenderer(item, indent, false);
                }
            }
            flushInlineBuffer();
        } else {
            // All items are inline: use JustifiedTextRenderer for optimal alignment
            JustifiedTextRenderer.renderStyledParagraph(
                doc,
                element.items,
                RenderStore.X + indent,
                RenderStore.Y,
                maxWidth,
            );
        }
    } else {
        // Simple text content without nested items
        const content = element.content ?? '';
        const textAlignment =
            RenderStore.options.content?.textAlignment ?? 'left';
        if (content.trim()) {
            TextRenderer.renderText(
                doc,
                content,
                RenderStore.X + indent,
                RenderStore.Y,
                maxWidth,
                textAlignment === 'justify',
            );
            // TextRenderer already updates Y for each line rendered
        }
    }

    RenderStore.updateX(RenderStore.options.page.xpading);
    RenderStore.deactivateInlineLock();
};

export default renderParagraph;
