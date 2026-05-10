// src/renderer/components/paragraph.ts
import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderStore } from '../../store/renderStore';
import { renderInlineContent } from '../../layout';
import { MdTokenType } from '../../enums/mdTokenType';

const renderParagraph = (
    doc: jsPDF,
    element: ParsedElement,
    indent: number,
    store: RenderStore,
    parentElementRenderer: (
        el: ParsedElement,
        level: number,
        store: RenderStore,
        hasRawBullet?: boolean,
    ) => void,
) => {
    const indentLevel = indent / store.options.page.indent;
    const savedColor = doc.getTextColor();
    doc.setFontSize(store.options.page.defaultFontSize);
    doc.setFont(
        store.options.font.regular.name,
        store.options.font.regular.style,
    );
    doc.setTextColor(store.options.paragraph?.color ?? '#000000');
    const maxWidth = store.options.page.maxContentWidth - indent;

    if (element.items && element.items.length > 0) {
        // Single block image: delegate to parent renderer
        if (
            element.items.length === 1 &&
            element.items[0].type === MdTokenType.Image
        ) {
            parentElementRenderer(element.items[0], indentLevel, store, false);
            store.updateX(store.options.page.xpading);
            doc.setTextColor(savedColor);
            return;
        }

        // Mixed content with block-level items
        const inlineTypes = [
            MdTokenType.Strong,
            MdTokenType.Em,
            MdTokenType.Text,
            MdTokenType.CodeSpan,
            MdTokenType.Link,
            MdTokenType.Image,
            MdTokenType.Br,
        ];
        const hasBlockItems = element.items.some(
            (item) => !inlineTypes.includes(item.type as MdTokenType),
        );

        if (hasBlockItems) {
            const inlineBuffer: ParsedElement[] = [];
            const flush = () => {
                if (inlineBuffer.length > 0) {
                    renderInlineContent(
                        doc,
                        inlineBuffer,
                        store.X + indent,
                        store.Y,
                        maxWidth,
                        store,
                        { trimLastLine: true },
                    );
                    inlineBuffer.length = 0;
                }
            };
            for (const item of element.items) {
                if (inlineTypes.includes(item.type as MdTokenType)) {
                    inlineBuffer.push(item);
                } else {
                    flush();
                    parentElementRenderer(item, indentLevel, store, false);
                }
            }
            flush();
        } else {
            renderInlineContent(
                doc,
                element.items,
                store.X + indent,
                store.Y,
                maxWidth,
                store,
                { trimLastLine: true },
            );
        }
    } else if (element.content?.trim()) {
        const textEl: ParsedElement = {
            type: 'text',
            content: element.content,
        };
        renderInlineContent(
            doc,
            [textEl],
            store.X + indent,
            store.Y,
            maxWidth,
            store,
            { trimLastLine: true },
        );
    }

    // Bottom spacing
    const bottomSpacing =
        store.options.paragraph?.bottomSpacing ??
        store.options.spacing?.afterParagraph ??
        store.options.page.lineSpace;
    store.updateY(bottomSpacing, 'add');
    store.updateX(store.options.page.xpading);
    doc.setTextColor(savedColor);
};

export default renderParagraph;
