// src/layout/wordSplitter.ts
import jsPDF from 'jspdf';
import { ParsedElement } from '../types/parsedElement';
import { TextStyle, StyledWordInfo } from '../types/styledWordInfo';
import { RenderStore } from '../store/renderStore';
import { calculateImageDimensions } from '../utils/image-utils';

/**
 * Maps a ParsedElement type string to a TextStyle.
 */
export const resolveStyle = (
    type: string,
    parentStyle?: TextStyle,
): TextStyle => {
    switch (type) {
        case 'strong':
            return parentStyle === 'italic' ? 'bolditalic' : 'bold';
        case 'em':
            return parentStyle === 'bold' ? 'bolditalic' : 'italic';
        case 'codespan':
            return 'codespan';
        default:
            return parentStyle ?? 'normal';
    }
};

/**
 * Measures the width of `text` rendered with `style`, including jsPDF charSpace.
 */
export const measureStyledWidth = (
    doc: jsPDF,
    text: string,
    style: TextStyle,
    store: RenderStore,
): number => {
    const savedFont = doc.getFont();
    const savedSize = doc.getFontSize();
    applyStyleToDoc(doc, style, store);
    const charSpace = doc.getCharSpace?.() ?? 0;
    const width = doc.getTextWidth(text) + text.length * charSpace;
    doc.setFont(savedFont.fontName, savedFont.fontStyle);
    doc.setFontSize(savedSize);
    return width;
};

/**
 * Applies a TextStyle to the jsPDF document.
 */
export const applyStyleToDoc = (
    doc: jsPDF,
    style: TextStyle,
    store: RenderStore,
): void => {
    const curFont = doc.getFont().fontName;
    const curSize = doc.getFontSize();
    const boldFont = store.options.font.bold?.name || curFont;
    const regularFont = store.options.font.regular?.name || curFont;
    const codeFont = store.options.font.code || {
        name: 'courier',
        style: 'normal',
    };

    switch (style) {
        case 'bold':
            doc.setFont(boldFont, store.options.font.bold?.style || 'bold');
            break;
        case 'italic':
            doc.setFont(regularFont, 'italic');
            break;
        case 'bolditalic':
            doc.setFont(boldFont, 'bolditalic');
            break;
        case 'codespan':
            doc.setFont(codeFont.name, codeFont.style);
            doc.setFontSize(
                curSize * (store.options.codespan?.fontSizeScale ?? 0.88),
            );
            break;
        default:
            doc.setFont(regularFont, 'normal');
            break;
    }
};

/**
 * Flattens a ParsedElement tree into a flat array of StyledWordInfo.
 * This is the single source of truth for converting AST → layout words.
 */
export const flattenToWords = (
    doc: jsPDF,
    elements: ParsedElement[],
    store: RenderStore,
    parentStyle: TextStyle = 'normal',
    isLink = false,
    href?: string,
): StyledWordInfo[] => {
    const result: StyledWordInfo[] = [];

    for (const el of elements) {
        const style = resolveStyle(el.type, parentStyle);
        const elIsLink = el.type === 'link' || isLink;
        const elHref = el.href || href;

        if (el.type === 'br') {
            result.push({ text: '', width: 0, style, isBr: true });
            continue;
        }

        if (el.type === 'image') {
            const { finalWidth, finalHeight } = calculateImageDimensions(
                doc,
                el,
                store.options.page.maxContentWidth,
                store.options.page.maxContentHeight -
                    store.options.page.topmargin,
                store.options.page.unit || 'mm',
            );
            result.push({
                text: '',
                width: finalWidth,
                style,
                isLink: elIsLink,
                href: elHref,
                isImage: true,
                imageElement: el,
                imageHeight: finalHeight,
            });
            continue;
        }

        if (el.items && el.items.length > 0) {
            result.push(
                ...flattenToWords(
                    doc,
                    el.items,
                    store,
                    style,
                    elIsLink,
                    elHref,
                ),
            );
            continue;
        }

        const text = el.content || el.text || '';
        if (!text) continue;

        // Preserve leading space as trailing-space flag on previous word
        if (/^\s/.test(text) && result.length > 0) {
            result[result.length - 1].hasTrailingSpace = true;
        }

        if (style === 'codespan') {
            const trimmed = text.trim();
            if (trimmed) {
                result.push({
                    text: trimmed,
                    width: measureStyledWidth(doc, trimmed, style, store),
                    style,
                    isLink: elIsLink,
                    href: elHref,
                    linkColor: elIsLink
                        ? store.options.link?.linkColor || [0, 0, 255]
                        : undefined,
                    hasTrailingSpace: /\s$/.test(text),
                });
            }
            continue;
        }

        // Split on newlines for hard breaks, then on whitespace for words
        const lines = text.split('\n');
        for (let li = 0; li < lines.length; li++) {
            const words = lines[li]
                .trim()
                .split(/[ \t\r\v\f]+/)
                .filter(Boolean);
            for (let wi = 0; wi < words.length; wi++) {
                const isLastInLine = wi === words.length - 1;
                result.push({
                    text: words[wi],
                    width: measureStyledWidth(doc, words[wi], style, store),
                    style,
                    isLink: elIsLink,
                    href: elHref,
                    linkColor: elIsLink
                        ? store.options.link?.linkColor || [0, 0, 255]
                        : undefined,
                    hasTrailingSpace: !isLastInLine || /[ \t]$/.test(lines[li]),
                });
            }
            if (li < lines.length - 1) {
                result.push({ text: '', width: 0, style, isBr: true });
            }
        }
    }

    return result;
};
