import jsPDF from 'jspdf';

/**
 * Helpers for reordering operations within a page's content stream.
 *
 * PDF content streams paint in emission order, so anything emitted after a
 * glyph run is drawn on top of it. A container that can only know its own
 * extent after laying out its children — a blockquote, for instance — must
 * therefore emit its background first, which it cannot do in a single pass.
 *
 * jsPDF keeps each page's operations as a flat array of strings, so the
 * background can be emitted last and then moved into place. Every access is
 * shape-checked: if a future jsPDF changes this structure, these helpers become
 * no-ops and the caller simply keeps the previous (background-last) behaviour
 * rather than crashing.
 */

const pageOps = (doc: jsPDF, page: number): string[] | null => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = (doc as any)?.internal?.pages;
    if (!Array.isArray(pages)) return null;
    const ops = pages[page];
    return Array.isArray(ops) ? ops : null;
};

/**
 * Number of operations currently recorded for `page`, or null when the content
 * stream is not in the expected shape.
 */
export const getPageOpCount = (doc: jsPDF, page: number): number | null => {
    const ops = pageOps(doc, page);
    return ops ? ops.length : null;
};

/**
 * Moves the operations appended at or after `from` so they instead sit at
 * `to`, preserving their relative order.
 *
 * Used to push a container's background behind content that was drawn before
 * the container knew how tall it would be.
 */
export const moveOpsBefore = (
    doc: jsPDF,
    page: number,
    from: number,
    to: number,
): void => {
    if (!Number.isInteger(from) || !Number.isInteger(to)) return;
    if (to >= from) return;

    const ops = pageOps(doc, page);
    if (!ops || from >= ops.length || to < 0) return;

    const moved = ops.splice(from, ops.length - from);
    ops.splice(to, 0, ...moved);
};
