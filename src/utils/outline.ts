// src/utils/outline.ts
import jsPDF from 'jspdf';
import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types/parsedElement';
import type { OutlineEntry } from '../store/renderStore';

/**
 * 1-based number of the page jsPDF is currently drawing on. Falls back to 1
 * for document stubs that lack jsPDF internals.
 */
export const currentPageNumber = (doc: jsPDF): number =>
    (
        doc as unknown as {
            internal?: {
                getCurrentPageInfo?: () => { pageNumber: number };
            };
        }
    ).internal?.getCurrentPageInfo?.()?.pageNumber ?? 1;

/**
 * Plain text of a heading without markup, used for outline titles:
 * `**Bold** title` → `Bold title`.
 */
export const headingPlainText = (element: ParsedElement): string => {
    if (element.items && element.items.length > 0) {
        return element.items.map(headingPlainText).join('');
    }
    if (element.type === MdTokenType.Image) return element.alt ?? '';
    return element.content ?? element.text ?? '';
};

type OutlineNode = { depth: number; node: unknown };

/**
 * Builds the PDF outline (bookmarks) from the headings recorded during
 * rendering: one entry per heading, nested by heading depth (an `##` under
 * the preceding `#`). Entries land alongside any outline the document
 * already had, e.g. from an earlier render into the same document.
 */
export const buildOutline = (
    doc: jsPDF,
    entries: readonly OutlineEntry[],
): void => {
    if (entries.length === 0) return;

    // Stack of the open outline nodes by depth; the outline root sits at
    // depth 0. A heading nests under the nearest preceding heading with a
    // smaller depth.
    const stack: OutlineNode[] = [{ depth: 0, node: null }];
    for (const entry of entries) {
        while (
            stack.length > 1 &&
            stack[stack.length - 1].depth >= entry.depth
        ) {
            stack.pop();
        }
        const parent = stack[stack.length - 1].node;
        const node = doc.outline.add(parent, entry.title, {
            pageNumber: entry.page,
        });
        stack.push({ depth: entry.depth, node });
    }
};
