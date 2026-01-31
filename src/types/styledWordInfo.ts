/**
 * Enhanced word info types for styled text justification.
 * These types allow tracking font styles per word for proper justified rendering.
 */

export type TextStyle =
    | 'normal'
    | 'bold'
    | 'italic'
    | 'bolditalic'
    | 'codespan';

/**
 * Information about a single styled word for justified text rendering.
 */
export interface StyledWordInfo {
    /** The word text */
    text: string;
    /** Measured width in PDF points */
    width: number;
    /** Font style to apply when rendering */
    style: TextStyle;
    /** Whether this word is part of a link */
    isLink?: boolean;
    /** URL if this is a link */
    href?: string;
    /** Optional link color override */
    linkColor?: number[];
}

/**
 * Represents a line of styled words for justified rendering.
 */
export interface StyledLine {
    /** Words in this line */
    words: StyledWordInfo[];
    /** Sum of word widths (without inter-word spacing) */
    totalTextWidth: number;
    /** Last line of paragraph shouldn't be fully justified */
    isLastLine: boolean;
}
