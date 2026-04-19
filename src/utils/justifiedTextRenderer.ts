import jsPDF from 'jspdf';
import { ParsedElement } from '../types/parsedElement';
import { TextStyle, StyledWordInfo, StyledLine } from '../types/styledWordInfo';
import { RenderStore } from '../store/renderStore';
import { getCharHight } from './doc-helpers';
import { HandlePageBreaks } from './handlePageBreak';
import { calculateImageDimensions } from './image-utils';

/**
 * JustifiedTextRenderer - Renders mixed inline elements with proper alignment.
 *
 * Features:
 * - Handles bold, italic, codespan, links mixed in paragraph
 * - Proper word spacing distribution for justified alignment
 * - Supports left, right, center, and justify alignments
 * - Page break handling
 * - Preserves link clickability
 * - Codespan background rendering
 */
export class JustifiedTextRenderer {
    // Default codespan styling (can be overridden via store.options.codespan)
    private static getCodespanOptions(store: RenderStore) {
        const opts = store.options.codespan ?? {};
        return {
            backgroundColor: opts.backgroundColor ?? '#EEEEEE',
            padding: opts.padding ?? 0.5,
            showBackground: opts.showBackground !== false,
            fontSizeScale: opts.fontSizeScale ?? 0.9,
        };
    }

    /**
     * Apply font style to the jsPDF document.
     */
    private static applyStyle(
        doc: jsPDF,
        style: TextStyle,
        store: RenderStore,
    ): void {
        const currentFont = doc.getFont().fontName;
        const currentFontSize = doc.getFontSize();

        // Helper to get font name with fallback
        const getBoldFont = () => {
            const boldName = store.options.font.bold?.name;
            return boldName && boldName !== '' ? boldName : currentFont;
        };
        const getRegularFont = () => {
            const regularName = store.options.font.regular?.name;
            return regularName && regularName !== ''
                ? regularName
                : currentFont;
        };

        switch (style) {
            case 'bold':
                doc.setFont(
                    getBoldFont(),
                    store.options.font.bold?.style || 'bold',
                );
                break;
            case 'italic':
                doc.setFont(getRegularFont(), 'italic');
                break;
            case 'bolditalic':
                doc.setFont(getBoldFont(), 'bolditalic');
                break;
            case 'codespan':
                doc.setFont('courier', 'normal');
                doc.setFontSize(
                    currentFontSize *
                        this.getCodespanOptions(store).fontSizeScale,
                );
                break;
            default:
                doc.setFont(getRegularFont(), doc.getFont().fontStyle);
                break;
        }
    }

    /**
     * Measure word width with a specific style applied.
     * NOTE: jsPDF's getTextWidth() does NOT include charSpace in its calculation,
     * so we must manually add it: effectiveWidth = getTextWidth(text) + (text.length * charSpace)
     */
    private static measureWordWidth(
        doc: jsPDF,
        text: string,
        style: TextStyle,
        store: RenderStore,
    ): number {
        const savedFont = doc.getFont();
        const savedSize = doc.getFontSize();

        this.applyStyle(doc, style, store);
        const baseWidth = doc.getTextWidth(text);

        // Account for character spacing: jsPDF adds charSpace after EACH character
        // For a word of N characters, rendering adds (N) * charSpace extra width
        // But getTextWidth doesn't include this, so we add it manually
        const charSpace = (doc as jsPDF).getCharSpace?.() ?? 0;
        const effectiveWidth = baseWidth + text.length * charSpace;

        // Restore
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedSize);

        return effectiveWidth;
    }

    /**
     * Extract style from element type string.
     */
    private static getStyleFromType(
        type: string,
        parentStyle?: TextStyle,
    ): TextStyle {
        switch (type) {
            case 'strong':
                if (parentStyle === 'italic') return 'bolditalic';
                return 'bold';
            case 'em':
                if (parentStyle === 'bold') return 'bolditalic';
                return 'italic';
            case 'codespan':
                return 'codespan';
            default:
                return parentStyle || 'normal';
        }
    }

    /**
     * Flatten ParsedElement tree into an array of StyledWordInfo.
     * Handles nested inline elements.
     */
    static flattenToWords(
        doc: jsPDF,
        elements: ParsedElement[],
        store: RenderStore,
        parentStyle: TextStyle = 'normal',
        isLink: boolean = false,
        href?: string,
    ): StyledWordInfo[] {
        const result: StyledWordInfo[] = [];

        for (const el of elements) {
            const style = this.getStyleFromType(el.type, parentStyle);
            const elIsLink = el.type === 'link' || isLink;
            const elHref = el.href || href;

            // If element has nested items, recurse
            if (el.items && el.items.length > 0) {
                const nested = this.flattenToWords(
                    doc,
                    el.items,
                    store,
                    style,
                    elIsLink,
                    elHref,
                );
                result.push(...nested);
            } else if (el.type === 'image') {
                const maxH =
                    store.options.page.maxContentHeight -
                    store.options.page.topmargin;
                const maxWidth =
                    store.options.page.maxContentWidth -
                    store.options.page.indent * 0; // we will keep it simple for inline
                const docUnit = store.options.page.unit || 'mm';
                const { finalWidth, finalHeight } = calculateImageDimensions(
                    doc,
                    el,
                    maxWidth,
                    maxH,
                    docUnit,
                );

                result.push({
                    text: '',
                    width: finalWidth,
                    style,
                    isLink: elIsLink,
                    href: elHref,
                    linkColor: elIsLink
                        ? store.options.link?.linkColor || [0, 0, 255]
                        : undefined,
                    isImage: true,
                    imageElement: el,
                    imageHeight: finalHeight,
                });
            } else if (el.type === 'br') {
                result.push({
                    text: '',
                    width: 0,
                    style,
                    isBr: true,
                });
            } else {
                // Leaf node: get text content
                const text = el.content || el.text || '';
                if (!text) continue;

                // Check if this text block STARTS with a space. If it does, we must
                // apply it to the LAST word we processed so they don't fuse.
                if (/^\s/.test(text) && result.length > 0) {
                    result[result.length - 1].hasTrailingSpace = true;
                }

                if (style === 'codespan') {
                    const trimmedText = text.trim();
                    if (trimmedText) {
                        result.push({
                            text: trimmedText,
                            width: this.measureWordWidth(
                                doc,
                                trimmedText,
                                style,
                                store,
                            ),
                            style,
                            isLink: elIsLink,
                            href: elHref,
                            linkColor: elIsLink
                                ? store.options.link?.linkColor || [0, 0, 255]
                                : undefined,
                            hasTrailingSpace: /\s$/.test(text), // Check if original code block ended in a space
                        });
                    }
                    continue;
                }

                // Split into words, ignoring spaces
                const words = text
                    .trim()
                    .split(/\s+/)
                    .filter((w) => w.length > 0);

                for (let i = 0; i < words.length; i++) {
                    const isLastWord = i === words.length - 1;
                    // The word has a trailing space if it's NOT the last word in the string,
                    // OR if it IS the last word, but the original string ended with a space.
                    const hasTrailingSpace = !isLastWord || /\s$/.test(text);

                    result.push({
                        text: words[i],
                        width: this.measureWordWidth(
                            doc,
                            words[i],
                            style,
                            store,
                        ),
                        style,
                        isLink: elIsLink,
                        href: elHref,
                        linkColor: elIsLink
                            ? store.options.link?.linkColor || [0, 0, 255]
                            : undefined,
                        hasTrailingSpace: hasTrailingSpace,
                    });
                }
            }
        }

        return result;
    }

    /**
     * Break a flat list of words into lines that fit within maxWidth.
     * Correctly tracks totalTextWidth (sum of word widths only) for justification.
     */
    static breakIntoLines(
        doc: jsPDF,
        words: StyledWordInfo[],
        maxWidth: number,
        store: RenderStore,
    ): StyledLine[] {
        const lines: StyledLine[] = [];
        let currentLine: StyledWordInfo[] = [];
        let currentTextWidth = 0; // Sum of word widths only
        let currentLineWidth = 0; // Including spaces for overflow check
        let currentLineHeight =
            getCharHight(doc) * store.options.page.defaultLineHeightFactor;

        // Get space width (using normal font)
        const spaceWidth = doc.getTextWidth(' ');

        for (let i = 0; i < words.length; i++) {
            const word = words[i];

            // For overflow check, we need to include space if the previous word had one
            const prevWord = currentLine[currentLine.length - 1];
            const neededWidthWithSpace = prevWord?.hasTrailingSpace
                ? spaceWidth + word.width
                : word.width;

            const itemHeight =
                word.isImage && word.imageHeight
                    ? word.imageHeight
                    : getCharHight(doc) *
                      store.options.page.defaultLineHeightFactor;

            if (word.isBr) {
                // Force a hard line break
                lines.push({
                    words: currentLine,
                    totalTextWidth: currentTextWidth,
                    isLastLine: true,
                    lineHeight: currentLineHeight,
                });
                currentLine = [];
                currentTextWidth = 0;
                currentLineWidth = 0;
                currentLineHeight =
                    getCharHight(doc) *
                    store.options.page.defaultLineHeightFactor;
                continue;
            }

            if (
                currentLineWidth + neededWidthWithSpace > maxWidth &&
                currentLine.length > 0
            ) {
                // Push current line
                lines.push({
                    words: currentLine,
                    totalTextWidth: currentTextWidth,
                    isLastLine: false,
                    lineHeight: currentLineHeight,
                });
                // Start new line with current word
                currentLine = [word];
                currentTextWidth = word.width;
                currentLineWidth = word.width;
                currentLineHeight = itemHeight;
            } else {
                currentLine.push(word);
                currentTextWidth += word.width;
                currentLineWidth += neededWidthWithSpace;
                currentLineHeight = Math.max(currentLineHeight, itemHeight);
            }
        }

        // Push last line
        if (currentLine.length > 0) {
            lines.push({
                words: currentLine,
                totalTextWidth: currentTextWidth,
                isLastLine: true,
                lineHeight: currentLineHeight,
            });
        }

        return lines;
    }

    /**
     * Render a single word with its style applied.
     */
    private static renderWord(
        doc: jsPDF,
        word: StyledWordInfo,
        x: number,
        y: number,
        store: RenderStore,
    ): void {
        const savedFont = doc.getFont();
        const savedSize = doc.getFontSize();
        const savedColor = doc.getTextColor();

        // Apply style
        this.applyStyle(doc, word.style, store);

        // Handle link color
        if (word.isLink && word.linkColor) {
            doc.setTextColor(...(word.linkColor as [number, number, number]));
        }

        if (word.isImage && word.imageElement && word.imageElement.data) {
            try {
                // Draw inline image
                let imgFormat = 'JPEG';
                if (word.imageElement.data.startsWith('data:image/png'))
                    imgFormat = 'PNG';
                else if (word.imageElement.data.startsWith('data:image/webp'))
                    imgFormat = 'WEBP';
                else if (word.imageElement.data.startsWith('data:image/gif'))
                    imgFormat = 'GIF';
                else if (word.imageElement.src) {
                    const urlWithoutQuery = word.imageElement.src
                        .split('?')[0]
                        .split('#')[0];
                    const ext = urlWithoutQuery.split('.').pop()?.toUpperCase();
                    if (
                        ext &&
                        ['PNG', 'JPEG', 'JPG', 'WEBP', 'GIF'].includes(ext)
                    ) {
                        imgFormat = ext === 'JPG' ? 'JPEG' : ext;
                    }
                }

                if (word.width > 0 && (word.imageHeight || 0) > 0) {
                    const imgH = word.imageHeight || 0;
                    // Draw image at the same Y as text (top-aligned),
                    // since text uses baseline: 'top'
                    const imgY = y;

                    doc.addImage(
                        word.imageElement.data,
                        imgFormat,
                        x,
                        imgY,
                        word.width,
                        imgH,
                    );
                }
            } catch (e) {
                console.warn('Failed to render inline image', e);
            }
        } else {
            // Draw codespan background if enabled
            if (word.style === 'codespan') {
                const codespanOpts = this.getCodespanOptions(store);
                if (codespanOpts.showBackground) {
                    const h = getCharHight(doc);
                    const pad = codespanOpts.padding;
                    // For codespan (which is kept as a single phrase),
                    // use word.width to ensure background covers full text including charSpace
                    doc.setFillColor(codespanOpts.backgroundColor);
                    doc.rect(
                        x - pad,
                        y - pad,
                        word.width + pad * 2,
                        h + pad * 2,
                        'F',
                    );
                    doc.setFillColor('#000000');
                }
            }

            // Draw text
            // Text is aligned to bottom of the line box to naturally sit on the baseline with images
            doc.text(word.text, x, y, { baseline: 'top' });
        }

        // Add link annotation if needed
        if (word.isLink && word.href) {
            const h =
                word.isImage && word.imageHeight
                    ? word.imageHeight
                    : getCharHight(doc);
            doc.link(x, y, word.width, h, { url: word.href });
        }

        // Restore
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedSize);
        doc.setTextColor(savedColor);
    }

    /**
     * Render a single line with specified alignment.
     */
    static renderAlignedLine(
        doc: jsPDF,
        line: StyledLine,
        x: number,
        y: number,
        maxWidth: number,
        store: RenderStore,
        alignment: 'left' | 'right' | 'center' | 'justify' = 'left',
    ): void {
        const { words, totalTextWidth, isLastLine } = line;

        if (words.length === 0) return;

        const normalSpaceWidth = doc.getTextWidth(' ');

        // Calculate starting X position based on alignment
        let startX = x;
        let wordSpacing = normalSpaceWidth;

        // Calculate line width with normal spaces, only where requested
        let lineWidthWithNormalSpaces = totalTextWidth;
        let expandableSpacesCount = 0;
        for (let i = 0; i < words.length - 1; i++) {
            if (words[i].hasTrailingSpace) {
                lineWidthWithNormalSpaces += normalSpaceWidth;
                expandableSpacesCount++;
            }
        }

        switch (alignment) {
            case 'right':
                startX = x + maxWidth - lineWidthWithNormalSpaces;
                break;
            case 'center':
                startX = x + (maxWidth - lineWidthWithNormalSpaces) / 2;
                break;
            case 'justify':
                if (!isLastLine && expandableSpacesCount > 0) {
                    const extraSpace = maxWidth - totalTextWidth;
                    wordSpacing = extraSpace / expandableSpacesCount;
                }
                break;
            case 'left':
            default:
                // Default left alignment, use normal spacing
                break;
        }

        // Render each word
        let currentX = startX;
        // Text height used for baseline alignment
        const textHeight =
            getCharHight(doc) * store.options.page.defaultLineHeightFactor;

        for (let i = 0; i < words.length; i++) {
            const word = words[i];

            // Calculate y-offset for baseline alignment
            // If the element is tall (e.g., an image), its top starts at y
            // If the element is short (e.g., normal text), it drops down to share the baseline with the tallest element
            let drawY = y;
            const elementHeight =
                word.isImage && word.imageHeight
                    ? word.imageHeight
                    : textHeight;

            if (word.isImage) {
                // Images: top-align within the line
                drawY = y;
            } else if (elementHeight < line.lineHeight) {
                // Text: bottom-align so text baseline sits at the bottom
                // of the tallest element (the image)
                drawY = y + (line.lineHeight - elementHeight);
            }

            this.renderWord(doc, word, currentX, drawY, store);
            currentX += word.width;
            if (i < words.length - 1 && word.hasTrailingSpace) {
                currentX += wordSpacing;
            }
        }
    }

    /**
     * Main entry point: Render a paragraph with mixed inline elements.
     * Respects user's textAlignment option from store.
     *
     * @param doc jsPDF instance
     * @param elements Array of ParsedElement (inline items in a paragraph)
     * @param x Starting X coordinate
     * @param y Starting Y coordinate
     * @param maxWidth Maximum width for text wrapping
     * @param store RenderStore instance to use
     * @param alignment Optional alignment override (defaults to store option)
     */
    static renderStyledParagraph(
        doc: jsPDF,
        elements: ParsedElement[],
        x: number,
        y: number,
        maxWidth: number,
        store: RenderStore,
        alignment?: 'left' | 'right' | 'center' | 'justify',
    ): void {
        // Use provided alignment or fall back to user options, default to 'left'
        const textAlignment =
            alignment ?? store.options.content?.textAlignment ?? 'left';

        // Flatten elements to words
        const words = this.flattenToWords(doc, elements, store);
        if (words.length === 0) return;

        // Break into lines
        const lines = this.breakIntoLines(doc, words, maxWidth, store);

        let currentY = y;

        for (const line of lines) {
            // Check for page break
            if (
                currentY + line.lineHeight >
                store.options.page.maxContentHeight
            ) {
                HandlePageBreaks(doc, store);
                currentY = store.Y;
            }

            // Render the line with proper alignment
            this.renderAlignedLine(
                doc,
                line,
                x,
                currentY,
                maxWidth,
                store,
                textAlignment,
            );

            // Record the visual bottom of the text on this line
            store.recordContentY(currentY + line.lineHeight);

            currentY += line.lineHeight;
            store.updateY(line.lineHeight, 'add');
        }

        // Update X position to end of last line for any inline continuation
        const lastLine = lines[lines.length - 1];
        if (lastLine) {
            let actualSpacesCount = 0;
            for (let i = 0; i < lastLine.words.length - 1; i++) {
                if (lastLine.words[i].hasTrailingSpace) {
                    actualSpacesCount++;
                }
            }

            const lastLineWidth =
                lastLine.totalTextWidth +
                actualSpacesCount * doc.getTextWidth(' ');
            store.updateX(x + lastLineWidth, 'set');
        }
    }

    /**
     * @deprecated Use renderStyledParagraph instead
     */
    static renderJustifiedParagraph(
        doc: jsPDF,
        elements: ParsedElement[],
        x: number,
        y: number,
        maxWidth: number,
        store: RenderStore,
    ): void {
        this.renderStyledParagraph(doc, elements, x, y, maxWidth, store);
    }
}
