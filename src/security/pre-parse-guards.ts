/**
 * Hard, unconditional safety limits applied to every Markdown input before
 * it reaches the underlying parser. These are NOT part of the opt-in
 * `security` option and cannot be disabled — they exist purely to prevent
 * the parser itself (a third-party dependency) from being driven into
 * stack-overflow or memory-exhaustion crashes, regardless of whether the
 * integrator has configured `security.enabled`.
 */

export class MarkdownParsingLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MarkdownParsingLimitError';
    }
}

/** Absolute ceiling on input size, enforced regardless of `security.enabled`. */
const ABSOLUTE_MAX_MARKDOWN_LENGTH = 2_000_000; // 2 MB

/**
 * Generous ceiling on structural nesting depth. Real-world documents rarely
 * nest blockquotes or lists more than 10–20 levels deep; 300 leaves ample
 * headroom while sitting far below the depths (~3,500 for blockquotes,
 * ~1,200 for list chains) needed to crash the underlying parser.
 */
const MAX_SAFE_STRUCTURAL_DEPTH = 300;

/** Matches a Markdown list item marker with its leading indentation. */
const LIST_ITEM_RE = /^([ \t]*)([-*+]|\d+[.)])\s/;

/**
 * Scans for the deepest run of `>` blockquote markers found at the start of
 * any single line. O(n) single pass, no recursion.
 */
const estimateMaxBlockquoteDepth = (text: string): number => {
    let maxDepth = 0;
    let i = 0;
    const len = text.length;
    while (i < len) {
        let lineEnd = text.indexOf('\n', i);
        if (lineEnd === -1) lineEnd = len;

        let j = i;
        let leadingSpaces = 0;
        while (j < lineEnd && text[j] === ' ' && leadingSpaces < 3) {
            j++;
            leadingSpaces++;
        }

        let depth = 0;
        while (j < lineEnd && text[j] === '>') {
            depth++;
            j++;
            if (text[j] === ' ') j++;
        }

        if (depth > maxDepth) maxDepth = depth;
        i = lineEnd + 1;
    }
    return maxDepth;
};

/**
 * Scans for the longest run of consecutive list-item lines whose indentation
 * strictly increases from one line to the next — the exact shape that
 * causes the underlying parser's memory blow-up. O(n) single pass.
 */
const estimateMaxListChainDepth = (text: string): number => {
    const lines = text.split('\n');
    let maxChain = 0;
    let chainLen = 0;
    let prevIndent = -1;

    for (const line of lines) {
        const match = LIST_ITEM_RE.exec(line);
        if (!match) {
            chainLen = 0;
            prevIndent = -1;
            continue;
        }
        const indent = match[1].length;
        chainLen = indent > prevIndent ? chainLen + 1 : 1;
        prevIndent = indent;
        if (chainLen > maxChain) maxChain = chainLen;
    }
    return maxChain;
};

/**
 * Throws if `text` exceeds the absolute hard length ceiling. Always runs,
 * regardless of the `security` option.
 */
export const enforceAbsoluteMarkdownLengthLimit = (text: string): void => {
    if (text.length > ABSOLUTE_MAX_MARKDOWN_LENGTH) {
        throw new MarkdownParsingLimitError(
            `[jspdf-md-renderer] Markdown input length (${text.length}) exceeds the ` +
            `absolute hard limit (${ABSOLUTE_MAX_MARKDOWN_LENGTH} characters). This limit ` +
            `is enforced unconditionally and cannot be disabled via the 'security' option.`,
        );
    }
};

/**
 * Throws if `text` contains blockquote or list nesting deep enough to risk
 * crashing the underlying parser. Always runs, regardless of the `security`
 * option.
 */
export const enforceStructuralSafetyLimits = (text: string): void => {
    const bqDepth = estimateMaxBlockquoteDepth(text);
    if (bqDepth > MAX_SAFE_STRUCTURAL_DEPTH) {
        throw new MarkdownParsingLimitError(
            `[jspdf-md-renderer] Blockquote nesting depth (${bqDepth}) exceeds the hard ` +
            `safety limit (${MAX_SAFE_STRUCTURAL_DEPTH}). This limit is enforced ` +
            `unconditionally to prevent parser stack exhaustion and cannot be disabled.`,
        );
    }

    const listChainDepth = estimateMaxListChainDepth(text);
    if (listChainDepth > MAX_SAFE_STRUCTURAL_DEPTH) {
        throw new MarkdownParsingLimitError(
            `[jspdf-md-renderer] List nesting chain depth (${listChainDepth}) exceeds the ` +
            `hard safety limit (${MAX_SAFE_STRUCTURAL_DEPTH}). This limit is enforced ` +
            `unconditionally to prevent parser memory exhaustion and cannot be disabled.`,
        );
    }
};
