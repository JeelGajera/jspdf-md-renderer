import jsPDF from 'jspdf';
import { ParsedElement } from '../types/parsedElement';
import { TextStyle, StyledWordInfo, StyledLine } from '../types/styledWordInfo';
import { RenderStore } from '../store/renderStore';
import { getCharHight } from './doc-helpers';
import { HandlePageBreaks } from './handlePageBreak';

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
    // Default codespan styling (can be overridden via RenderStore.options.codespan)
    private static getCodespanOptions() {
        const opts = RenderStore.options.codespan ?? {};
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
    private static applyStyle(doc: jsPDF, style: TextStyle): void {
        const currentFont = doc.getFont().fontName;
        const currentFontSize = doc.getFontSize();

        // Helper to get font name with fallback
        const getBoldFont = () => {
            const boldName = RenderStore.options.font.bold?.name;
            return boldName && boldName !== '' ? boldName : currentFont;
        };
        const getRegularFont = () => {
            const regularName = RenderStore.options.font.regular?.name;
            return regularName && regularName !== ''
                ? regularName
                : currentFont;
        };

        switch (style) {
            case 'bold':
                doc.setFont(
                    getBoldFont(),
                    RenderStore.options.font.bold?.style || 'bold',
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
                    currentFontSize * this.getCodespanOptions().fontSizeScale,
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
    ): number {
        const savedFont = doc.getFont();
        const savedSize = doc.getFontSize();

        this.applyStyle(doc, style);
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
                    style,
                    elIsLink,
                    elHref,
                );
                result.push(...nested);
            } else {
                // Leaf node: get text content
                const text = el.content || el.text || '';
                if (!text) continue;

                // For codespan, keep the entire content as a single unit (don't split into words)
                // This ensures the background covers all text including spaces between words
                if (style === 'codespan') {
                    const trimmedText = text.trim();
                    if (trimmedText) {
                        result.push({
                            text: trimmedText,
                            width: this.measureWordWidth(
                                doc,
                                trimmedText,
                                style,
                            ),
                            style,
                            isLink: elIsLink,
                            href: elHref,
                            linkColor: elIsLink
                                ? RenderStore.options.link?.linkColor || [
                                      0, 0, 255,
                                  ]
                                : undefined,
                        });
                    }
                    continue;
                }

                // Split into words (preserving the knowledge of surrounding whitespace)
                const words = text.split(/\s+/).filter((w) => w.length > 0);

                // If text is ONLY whitespace, it acts as a word boundary marker
                // We handle this by ensuring the previous and next words aren't joined
                if (words.length === 0) {
                    // Mark that there should be separation (handled by normal space width in rendering)
                    continue;
                }

                for (let i = 0; i < words.length; i++) {
                    const word = words[i];
                    result.push({
                        text: word,
                        width: this.measureWordWidth(doc, word, style),
                        style,
                        isLink: elIsLink,
                        href: elHref,
                        linkColor: elIsLink
                            ? RenderStore.options.link?.linkColor || [0, 0, 255]
                            : undefined,
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
    ): StyledLine[] {
        const lines: StyledLine[] = [];
        let currentLine: StyledWordInfo[] = [];
        let currentTextWidth = 0; // Sum of word widths only
        let currentLineWidth = 0; // Including spaces for overflow check

        // Get space width (using normal font)
        const spaceWidth = doc.getTextWidth(' ');

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            // For overflow check, we need to include space before word (if not first word)
            const neededWidthWithSpace =
                currentLine.length > 0 ? spaceWidth + word.width : word.width;

            if (
                currentLineWidth + neededWidthWithSpace > maxWidth &&
                currentLine.length > 0
            ) {
                // Push current line with correct totalTextWidth (no spaces)
                lines.push({
                    words: currentLine,
                    totalTextWidth: currentTextWidth,
                    isLastLine: false,
                });
                // Start new line with current word
                currentLine = [word];
                currentTextWidth = word.width;
                currentLineWidth = word.width;
            } else {
                currentLine.push(word);
                currentTextWidth += word.width;
                currentLineWidth += neededWidthWithSpace;
            }
        }

        // Push last line
        if (currentLine.length > 0) {
            lines.push({
                words: currentLine,
                totalTextWidth: currentTextWidth,
                isLastLine: true,
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
    ): void {
        const savedFont = doc.getFont();
        const savedSize = doc.getFontSize();
        const savedColor = doc.getTextColor();

        // Apply style
        this.applyStyle(doc, word.style);

        // Handle link color
        if (word.isLink && word.linkColor) {
            doc.setTextColor(...(word.linkColor as [number, number, number]));
        }

        // Draw codespan background if enabled
        if (word.style === 'codespan') {
            const codespanOpts = this.getCodespanOptions();
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
        doc.text(word.text, x, y, { baseline: 'top' });

        // Add link annotation if needed
        if (word.isLink && word.href) {
            const h = getCharHight(doc) / 2;
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
        alignment: 'left' | 'right' | 'center' | 'justify' = 'left',
    ): void {
        const { words, totalTextWidth, isLastLine } = line;

        if (words.length === 0) return;

        const normalSpaceWidth = doc.getTextWidth(' ');

        // Calculate starting X position based on alignment
        let startX = x;
        let wordSpacing = normalSpaceWidth;

        const lineWidthWithNormalSpaces =
            totalTextWidth + (words.length - 1) * normalSpaceWidth;

        switch (alignment) {
            case 'right':
                startX = x + maxWidth - lineWidthWithNormalSpaces;
                break;
            case 'center':
                startX = x + (maxWidth - lineWidthWithNormalSpaces) / 2;
                break;
            case 'justify':
                if (!isLastLine && words.length > 1) {
                    const extraSpace = maxWidth - totalTextWidth;
                    wordSpacing = extraSpace / (words.length - 1);
                }
                break;
            case 'left':
            default:
                // Default left alignment, use normal spacing
                break;
        }

        // Render each word
        let currentX = startX;
        for (let i = 0; i < words.length; i++) {
            this.renderWord(doc, words[i], currentX, y);
            currentX += words[i].width;
            if (i < words.length - 1) {
                currentX += wordSpacing;
            }
        }
    }

    /**
     * Main entry point: Render a paragraph with mixed inline elements.
     * Respects user's textAlignment option from RenderStore.
     *
     * @param doc jsPDF instance
     * @param elements Array of ParsedElement (inline items in a paragraph)
     * @param x Starting X coordinate
     * @param y Starting Y coordinate
     * @param maxWidth Maximum width for text wrapping
     * @param alignment Optional alignment override (defaults to RenderStore option)
     */
    static renderStyledParagraph(
        doc: jsPDF,
        elements: ParsedElement[],
        x: number,
        y: number,
        maxWidth: number,
        alignment?: 'left' | 'right' | 'center' | 'justify',
    ): void {
        // Use provided alignment or fall back to user options, default to 'left'
        const textAlignment =
            alignment ?? RenderStore.options.content?.textAlignment ?? 'left';

        // Flatten elements to words
        const words = this.flattenToWords(doc, elements);
        if (words.length === 0) return;

        // Break into lines
        const lines = this.breakIntoLines(doc, words, maxWidth);

        const lineHeight =
            getCharHight(doc) *
            RenderStore.options.page.defaultLineHeightFactor;

        let currentY = y;

        for (const line of lines) {
            // Check for page break
            if (
                currentY + lineHeight >
                RenderStore.options.page.maxContentHeight
            ) {
                HandlePageBreaks(doc);
                currentY = RenderStore.Y;
            }

            // Render the line with proper alignment
            this.renderAlignedLine(
                doc,
                line,
                x,
                currentY,
                maxWidth,
                textAlignment,
            );

            // Record the visual bottom of the text on this line
            RenderStore.recordContentY(currentY + getCharHight(doc));

            currentY += lineHeight;
            RenderStore.updateY(lineHeight, 'add');
        }

        // Update X position to end of last line for any inline continuation
        const lastLine = lines[lines.length - 1];
        if (lastLine) {
            const lastLineWidth =
                lastLine.totalTextWidth +
                (lastLine.words.length - 1) * doc.getTextWidth(' ');
            RenderStore.updateX(x + lastLineWidth, 'set');
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
    ): void {
        this.renderStyledParagraph(doc, elements, x, y, maxWidth);
    }
}
