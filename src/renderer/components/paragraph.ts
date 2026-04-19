import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderStore } from '../../store/renderStore';
import { JustifiedTextRenderer } from '../../utils/justifiedTextRenderer';
import { TextRenderer } from '../../utils/text-renderer';
import { MdTokenType } from '../../enums/mdTokenType';

/**
 * Renders paragraph elements with proper text alignment.
 * Handles mixed inline styles (bold, italic, codespan) and links.
 * Respects user's textAlignment option from RenderStore.
 */
const renderParagraph = (
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
    store.activateInlineLock();
    doc.setFontSize(store.options.page.defaultFontSize);

    const maxWidth = store.options.page.maxContentWidth - indent;

    if (element?.items && element?.items.length > 0) {
        // If it's just a single image, render as a block image
        if (element.items.length === 1 && element.items[0].type === 'image') {
            parentElementRenderer(element.items[0], indent, store, false);
            store.updateX(store.options.page.xpading);
            store.deactivateInlineLock();
            return;
        }

        const inlineTypes: string[] = [
            MdTokenType.Strong,
            MdTokenType.Em,
            MdTokenType.Text,
            MdTokenType.CodeSpan,
            MdTokenType.Link,
            MdTokenType.Image,
            MdTokenType.Br,
        ];

        // Check if there are any non-inline items that need special handling
        const hasNonInlineItems = element.items.some(
            (item) => !inlineTypes.includes(item.type),
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
                        store.X + indent,
                        store.Y,
                        maxWidth,
                        store,
                    );
                    inlineBuffer.length = 0;
                }
            };

            for (const item of element.items) {
                if (inlineTypes.includes(item.type)) {
                    inlineBuffer.push(item);
                } else {
                    flushInlineBuffer();
                    parentElementRenderer(item, indent, store, false);
                }
            }
            flushInlineBuffer();
        } else {
            // All items are inline: use JustifiedTextRenderer for optimal alignment
            JustifiedTextRenderer.renderStyledParagraph(
                doc,
                element.items,
                store.X + indent,
                store.Y,
                maxWidth,
                store,
            );
        }
    } else {
        // Simple text content without nested items
        const content = element.content ?? '';
        const textAlignment = store.options.content?.textAlignment ?? 'left';
        if (content.trim()) {
            TextRenderer.renderText(
                doc,
                content,
                store,
                store.X + indent,
                store.Y,
                maxWidth,
                textAlignment === 'justify',
            );
            // TextRenderer already updates Y for each line rendered
        }
    }

    store.updateX(store.options.page.xpading);
    store.deactivateInlineLock();
};

export default renderParagraph;
