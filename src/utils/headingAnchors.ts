// src/utils/headingAnchors.ts
import jsPDF from 'jspdf';
import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types/parsedElement';
import type { RenderStore } from '../store/renderStore';
import { getCurrentPageNumber } from './doc-helpers';

/**
 * Where a heading was drawn, so `[text](#slug)` links can jump to it.
 */
export type HeadingAnchor = {
    /** GitHub-style slug, unique within the render (`my-heading`, `my-heading-1`, …). */
    slug: string;
    /** 1-based page the heading was drawn on. */
    page: number;
    /** Y position of the heading's first line, in document units. */
    top: number;
};

/**
 * An `#anchor` link collected while rendering. The target heading may not
 * have been drawn yet, so the real jsPDF link is created once rendering is
 * complete and every heading position is known.
 */
export type PendingAnchorLink = {
    /** Fragment without the leading `#`. */
    anchor: string;
    /** 1-based page the link was drawn on. */
    page: number;
    x: number;
    y: number;
    w: number;
    h: number;
};

/**
 * GitHub-style slug for a heading: `My Heading!` → `my-heading`.
 * Lowercases, drops punctuation, and turns whitespace runs into hyphens.
 */
export const slugifyHeading = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
        .trim()
        .replace(/\s+/g, '-');

/**
 * Plain text of a heading without markup, used for slugs and titles:
 * `**Bold** title` → `Bold title`.
 */
export const headingPlainText = (element: ParsedElement): string => {
    if (element.items && element.items.length > 0) {
        return element.items.map(headingPlainText).join('');
    }
    if (element.type === MdTokenType.Image) return element.alt ?? '';
    return element.content ?? element.text ?? '';
};

/**
 * Creates the real jsPDF links for every `#anchor` link collected during
 * rendering. A link whose anchor matches a drawn heading jumps to that
 * heading's page and position; anything else keeps the historical behaviour
 * of being emitted as a plain URL link.
 *
 * Runs after rendering is complete so forward links — pointing at headings
 * drawn after the link — resolve too. jsPDF attaches a link annotation to
 * the current page, so each link is created with its own source page
 * selected, then the original page is restored.
 */
export const resolveAnchorLinks = (doc: jsPDF, store: RenderStore): void => {
    const pending = store.pendingAnchorLinks;
    if (pending.length === 0) return;

    const restorePage = getCurrentPageNumber(doc);
    try {
        for (const link of pending) {
            const target = store.getHeadingAnchor(link.anchor);
            doc.setPage(link.page);
            if (target) {
                doc.link(link.x, link.y, link.w, link.h, {
                    pageNumber: target.page,
                    top: target.top,
                });
            } else {
                doc.link(link.x, link.y, link.w, link.h, {
                    url: `#${link.anchor}`,
                });
            }
        }
    } finally {
        doc.setPage(restorePage);
    }
};
