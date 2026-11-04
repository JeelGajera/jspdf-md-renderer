import { Cursor, ResolvedRenderOption } from '../types';
import { RenderWarning, RenderWarnings } from './renderWarnings';
import {
    HeadingAnchor,
    PendingAnchorLink,
    slugifyHeading,
} from '../utils/headingAnchors';

/** A heading recorded for the PDF outline (bookmarks). */
export type OutlineEntry = {
    /** Heading depth, 1–6. */
    depth: number;
    /** The heading's plain text without markup. */
    title: string;
    /** 1-based page the heading was drawn on. */
    page: number;
};

export class RenderStore {
    private cursor: Cursor = { x: 0, y: 0 };
    private lastContentY_: number = 0;
    private options_: ResolvedRenderOption;
    private inlineLock: boolean = false;
    /**
     * Index into a page's content stream at which this render's own drawing
     * begins. Lets containers insert a background ahead of their children
     * without disturbing anything drawn on the page beforehand.
     */
    private pageContentStarts_: Map<number, number> = new Map();
    private warnings_: RenderWarnings;
    /**
     * Headings recorded for the opt-in PDF outline, in document order.
     * Built into nested outline items once rendering is complete.
     */
    private outlineEntries_: OutlineEntry[] = [];
    /**
     * Heading anchors drawn so far, keyed by their GitHub-style slug.
     * Lets `[text](#slug)` links jump to the heading's page and position.
     */
    private headingAnchors_: Map<string, HeadingAnchor> = new Map();
    /**
     * Next suffix to try for each slug base. Restarting the search at zero
     * for every repeated heading is quadratic (20,000 repeated headings did
     * ~200M registry lookups); this counter only ever advances, so the
     * total suffix search across a render is linear in the headings drawn.
     * The occupied registry above stays the authority — the loop below
     * keeps advancing past slugs a natural heading already took, and the
     * counter is only stored after a free slug is found, so no unused
     * candidate below it can exist (occupancy never decreases).
     */
    private headingAnchorNextSuffix_: Map<string, number> = new Map();
    /**
     * `#anchor` links collected during rendering. Resolved once rendering is
     * complete, because a link can point at a heading drawn after it.
     */
    private pendingAnchorLinks_: PendingAnchorLink[] = [];

    constructor(options: ResolvedRenderOption, warnings?: RenderWarnings) {
        this.options_ = options;
        this.warnings_ = warnings ?? new RenderWarnings();
        this.cursor = { x: options.cursor.x, y: options.cursor.y };
        this.lastContentY_ = options.cursor.y;
    }

    public getCursor(): Cursor {
        return this.cursor;
    }

    public setCursor(newCursor: Cursor) {
        this.cursor = newCursor;
    }

    public get options(): ResolvedRenderOption {
        return this.options_;
    }

    public get isInlineLockActive(): boolean {
        return this.inlineLock;
    }

    public activateInlineLock() {
        this.inlineLock = true;
    }

    public deactivateInlineLock() {
        this.inlineLock = false;
    }

    /**
     * Updates the x pointer of the cursor.
     * @param value The value to set or add.
     * @param operation 'set' to assign a new value, 'add' to increment the current value.
     * @default operation = 'set'
     */
    public updateX(value: number, operation: 'set' | 'add' = 'set') {
        if (operation === 'set') {
            this.cursor.x = value;
        } else if (operation === 'add') {
            this.cursor.x += value;
        }
    }

    /**
     * Updates the y pointer of the cursor.
     * @param value The value to set or add.
     * @param operation 'set' to assign a new value, 'add' to increment the current value.
     * @default operation = 'set'
     */
    public updateY(value: number, operation: 'set' | 'add' = 'set') {
        if (operation === 'set') {
            this.cursor.y = value;
        } else if (operation === 'add') {
            this.cursor.y += value;
        }
    }

    /**
     * Records a Y position as the bottom of rendered content.
     * This is useful for container components (like blockquotes) to know
     * where their actual text content ends, ignoring any trailing margins.
     * @param specificY Optional Y value to record. Defaults to current cursor Y.
     */
    public recordContentY(specificY?: number) {
        this.lastContentY_ =
            specificY !== undefined ? specificY : this.cursor.y;
    }

    /**
     * Gets the last Y position recorded as content bottom.
     */
    public get lastContentY(): number {
        return this.lastContentY_;
    }

    /**
     * Records something the render decided not to draw, so the caller can see
     * it on the returned result instead of only in the console.
     */
    public warn(warning: RenderWarning) {
        this.warnings_.warn(warning);
    }

    /** Records where this render's content begins on `page`. */
    public recordPageContentStart(page: number, opIndex: number) {
        if (!this.pageContentStarts_.has(page)) {
            this.pageContentStarts_.set(page, opIndex);
        }
    }

    /** Where this render's content begins on `page`, if known. */
    public getPageContentStart(page: number): number | undefined {
        return this.pageContentStarts_.get(page);
    }

    /**
     * Records a heading for the opt-in PDF outline (bookmarks). Entries are
     * turned into nested outline items once rendering is complete.
     */
    public addOutlineEntry(entry: OutlineEntry): void {
        this.outlineEntries_.push(entry);
    }

    /** Headings recorded for the outline, in document order. */
    public get outlineEntries(): readonly OutlineEntry[] {
        return this.outlineEntries_;
    }

    /**
     * Records a heading's draw position for `[text](#slug)` links. The slug
     * is GitHub-style (`My Heading` → `my-heading`); repeated headings get
     * `-1`, `-2` suffixes. The occupied set includes every already-assigned
     * slug — including ones that came from natural heading names with
     * numeric suffixes (`A-1` → `a-1`) — so the candidate is incremented
     * until it is unused and no destination is ever overwritten.
     * Returns the slug that was registered.
     */
    public registerHeadingAnchor(
        plainText: string,
        page: number,
        top: number,
    ): string {
        const base = slugifyHeading(plainText);
        let suffix = this.headingAnchorNextSuffix_.get(base) ?? 0;
        let slug = suffix === 0 ? base : `${base}-${suffix}`;
        while (this.headingAnchors_.has(slug)) {
            suffix += 1;
            slug = `${base}-${suffix}`;
        }
        this.headingAnchors_.set(slug, { slug, page, top });
        this.headingAnchorNextSuffix_.set(base, suffix + 1);
        return slug;
    }

    /** The draw position of the heading with `slug`, if one was drawn. */
    public getHeadingAnchor(slug: string): HeadingAnchor | undefined {
        return this.headingAnchors_.get(slug);
    }

    /**
     * Defers an `#anchor` link for resolution after rendering completes,
     * when every heading position is known.
     */
    public deferAnchorLink(link: PendingAnchorLink): void {
        this.pendingAnchorLinks_.push(link);
    }

    /** `#anchor` links collected during rendering, in draw order. */
    public get pendingAnchorLinks(): readonly PendingAnchorLink[] {
        return this.pendingAnchorLinks_;
    }

    // Convenience methods to get individual x and y values
    public get X(): number {
        return this.cursor.x;
    }

    public get Y(): number {
        return this.cursor.y;
    }
}
