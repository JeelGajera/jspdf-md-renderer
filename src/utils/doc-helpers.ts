import jsPDF from 'jspdf';

export const getCharHight = (doc: jsPDF): number => {
    // Use raw font height (fontSize / scaleFactor) instead of getTextDimensions
    // which includes jsPDF's internal lineHeightFactor (~1.15). This avoids
    // double line-height-factoring when callers multiply by defaultLineHeightFactor.
    return doc.getFontSize() / doc.internal.scaleFactor;
};

export const getCharWidth = (doc: jsPDF): number => {
    return doc.getTextDimensions('H').w;
};

/**
 * The unit a jsPDF document actually draws in, recovered from its scale factor.
 *
 * jsPDF does not expose the constructor's `unit` after creation, and the
 * renderer's `page.unit` option defaults to `'mm'` no matter how the document
 * was created — so a document built with `unit: 'pt'` would have images sized
 * as though it were millimetres. `scaleFactor` is points-per-unit, and the six
 * supported units have distinct values, so the unit can be recovered from it.
 *
 * Returns `null` when the scale factor is missing or unrecognised (e.g. a mock
 * document), so the caller can fall back to its own default.
 */
export const getDocUnit = (doc: jsPDF): string | null => {
    const sf = doc?.internal?.scaleFactor;
    if (typeof sf !== 'number' || Number.isNaN(sf)) return null;
    if (Math.abs(sf - 72) < 1e-6) return 'in';
    if (Math.abs(sf - 28.346456692913385) < 1e-3) return 'cm';
    if (Math.abs(sf - 12) < 1e-6) return 'pc';
    if (Math.abs(sf - 2.834645669291339) < 1e-3) return 'mm';
    if (Math.abs(sf - 4 / 3) < 1e-6) return 'px';
    if (Math.abs(sf - 1) < 1e-6) return 'pt';
    return null;
};

/**
 * Saves the current jsPDF font, size, and text color, executes `fn`,
 * then restores those properties — even if `fn` throws.
 */
export const withSavedDocState = <T>(doc: jsPDF, fn: () => T): T => {
    const savedFont = doc.getFont();
    const savedSize = doc.getFontSize();
    const savedColor = doc.getTextColor();
    try {
        return fn();
    } finally {
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedSize);
        doc.setTextColor(savedColor);
    }
};
