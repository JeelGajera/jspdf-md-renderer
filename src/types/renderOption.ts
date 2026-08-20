import jsPDF, { jsPDFOptions } from 'jspdf';
import { UserOptions } from 'jspdf-autotable';
import { RenderSecurityOptions, SecurityViolation } from './security';
import { RenderWarning, WarningListener } from '../store/renderWarnings';
import { ComponentOverrides } from './components';

export type RenderOption = {
    /**
     * Where rendering starts. Defaults to the top-left of the content area —
     * `{ x: page.xpading, y: page.topmargin }`, or the margin origin when
     * `page.margin` is used.
     *
     * Note that only the first line honours `cursor.x`; subsequent blocks start
     * at the left edge of the content column.
     */
    cursor?: {
        x: number;
        y: number;
    };
    page?: {
        format?: string | number[];
        unit?: jsPDFOptions['unit'];
        orientation?: jsPDFOptions['orientation'];
        /**
         * Page margins in document units. When present, the content area is
         * derived from the document's own page size, and the individual
         * geometry fields below are computed rather than supplied.
         *
         * Prefer this over setting `maxContentWidth`/`maxContentHeight` by hand:
         * those must be kept consistent with the page format manually, and an
         * inconsistent pair is the most common source of layout surprises.
         */
        margin?: PageMargin;
        /**
         * Width of the content column in document units.
         * @deprecated Prefer `page.margin`, which derives this from the document.
         */
        maxContentWidth?: number;
        /**
         * Absolute Y coordinate of the bottom of the content area — not a
         * height, despite the name.
         * @deprecated Prefer `page.margin`, which derives this from the document.
         */
        maxContentHeight?: number;
        lineSpace?: number;
        defaultLineHeightFactor?: number;
        defaultFontSize?: number;
        defaultTitleFontSize?: number;
        /**
         * Y coordinate at which content starts on each page.
         * @deprecated Prefer `page.margin.top`.
         */
        topmargin?: number;
        /**
         * X coordinate of the left edge of the content column.
         * @deprecated Prefer `page.margin.left`.
         */
        xpading?: number;
        /**
         * Horizontal margin used when positioning headers and footers.
         * @deprecated Prefer `page.margin`.
         */
        xmargin?: number;
        indent?: number;
    };
    font?: {
        /** Defaults to helvetica bold. */
        bold?: FontItem;
        regular: FontItem;
        /**
         * @deprecated Never read by the renderer. Supplying it has no effect
         * and it will be removed in a future major version.
         */
        light?: FontItem;
        italic?: FontItem;
        boldItalic?: FontItem;
        code?: FontItem;
    };
    heading?: {
        /** Whether headings should use bold font. Default: true */
        bold?: boolean;
        /** Font size for h1-h6. Values are absolute (e.g. 22, 20, 18, 16, 14, 12). */
        h1?: number;
        h2?: number;
        h3?: number;
        h4?: number;
        h5?: number;
        h6?: number;
        /** Space below heading before next element, in doc units. Default: 2 */
        bottomSpacing?: number;
        /** Text color for all headings as hex. Default: '#000000' */
        color?: string;
        h1Color?: string;
        h2Color?: string;
        h3Color?: string;
        h4Color?: string;
        h5Color?: string;
        h6Color?: string;
    };
    list?: {
        /** Bullet character for unordered lists. Default: '\u2022 ' */
        bulletChar?: string;
        /** Extra indent per nesting level in doc units. Default: uses page.indent */
        indentSize?: number;
        /** Vertical space between list items. Used when spacing.betweenListItems is not provided. */
        itemSpacing?: number;
    };
    paragraph?: {
        /** Space below each paragraph in doc units. Default: lineSpace */
        bottomSpacing?: number;
        /** Text color for paragraph text as hex. Default: '#000000' */
        color?: string;
    };
    blockquote?: {
        /** Left bar color as hex. Default: '#AAAAAA' */
        barColor?: string;
        /** Left bar width in doc units. Default: 1 */
        barWidth?: number;
        /** Left padding from bar to text in doc units. Default: 4 */
        paddingLeft?: number;
        /** Background color as hex. Default: undefined (transparent) */
        backgroundColor?: string;
        /** Space below blockquote before next element, in doc units. Default: lineSpace */
        bottomSpacing?: number;
    };
    content?: {
        textAlignment: 'left' | 'right' | 'center' | 'justify';
    };
    codespan?: {
        /** Background color for inline code. Default: '#EEEEEE' */
        backgroundColor?: string;
        /** Padding around inline code text. Default: 0.5 */
        padding?: number;
        /** Whether to show background rectangle. Default: true */
        showBackground?: boolean;
        /** Font size scale factor for code. Default: 0.9 */
        fontSizeScale?: number;
    };
    link?: {
        linkColor: [number, number, number];
    };
    table?: UserOptions;
    image?: {
        /** Default alignment for images: 'left' | 'center' | 'right'. Default: 'left' */
        defaultAlign?: 'left' | 'center' | 'right';
    };
    codeBlock?: {
        backgroundColor?: string;
        borderColor?: string;
        borderRadius?: number;
        padding?: number;
        fontSizeScale?: number;
        /** Whether to show language label. Default: true */
        showLanguageLabel?: boolean;
        /** Text color for code content as hex. Default: '#000000' */
        textColor?: string;
        /** Language label color as hex. Default: '#666666' */
        labelColor?: string;
    };
    spacing?: {
        /** Space below headings in doc units. Default: 2 */
        afterHeading?: number;
        /** Space below paragraphs in doc units. Default: 3 */
        afterParagraph?: number;
        /** Space below code blocks in doc units. Default: 3 */
        afterCodeBlock?: number;
        /** Space below blockquotes in doc units. Default: 3 */
        afterBlockquote?: number;
        /** Space below images in doc units. Default: 2 */
        afterImage?: number;
        /** Space below horizontal rules in doc units. Default: 2 */
        afterHR?: number;
        /** Space between list items in doc units. Default: 0 */
        betweenListItems?: number;
        /** Space below a complete list in doc units. Default: 3 */
        afterList?: number;
        /** Space below tables in doc units. Default: 3 */
        afterTable?: number;
        /**
         * How blank lines between blocks affect vertical spacing.
         *
         * - `'preserve'` (default): each blank line in the source adds a line
         *   of space on top of the `spacing.*` values. This is the historical
         *   behaviour and keeps existing documents rendering identically.
         * - `'collapse'`: blank lines add nothing, so the `spacing.*` options
         *   alone determine the gap between blocks.
         *
         * `'collapse'` is the intended behaviour and becomes the default in the
         * next major version.
         */
        blankLines?: 'preserve' | 'collapse';
    };
    header?: {
        /** Text to render in header area of each page */
        text?: string | ((pageNumber: number, totalPages: number) => string);
        /** Y position of header text from top in doc units. Default: 5 */
        y?: number;
        /** Font size for header text. Default: 9 */
        fontSize?: number;
        /** Text color for header. Default: '#666666' */
        color?: string;
        /** Alignment of header text. Default: 'center' */
        align?: 'left' | 'center' | 'right';
    };
    footer?: {
        /** Text to render in footer area of each page */
        text?: string | ((pageNumber: number, totalPages: number) => string);
        /** Y position from top of page in doc units. Default: pageHeight - 5 */
        y?: number;
        /** Font size for footer text. Default: 9 */
        fontSize?: number;
        /** Text color for footer. Default: '#666666' */
        color?: string;
        /** Alignment of footer text. Default: 'right' */
        align?: 'right' | 'left' | 'center';
        /** Shortcut: render page numbers with format "Page X of Y" */
        showPageNumbers?: boolean;
    };
    /**
     * How a single newline inside a paragraph is treated.
     *
     * - `true` (default): renders a hard line break. This is the historical
     *   behaviour and keeps existing documents rendering identically.
     * - `false`: renders a space, which is what CommonMark specifies for a
     *   soft line break.
     *
     * `false` becomes the default in the next major version.
     */
    breaks?: boolean;
    /**
     * Called for each thing the render decided not to draw. Fires in addition
     * to the `warnings` array on the result.
     */
    onWarning?: WarningListener;
    /**
     * Replace or decorate the built-in block renderers.
     *
     * Each override receives the drawing context and a `next()` that runs the
     * built-in, so an override can decorate rather than replace. An override
     * that throws is reported and falls back to the built-in.
     */
    components?: ComponentOverrides;
    /**
     * Suppresses the library's own `console.warn` output. Warnings are still
     * collected on the result and still reach `onWarning`.
     */
    silent?: boolean;
    pageBreakHandler?: (doc: jsPDF) => void;
    /**
     * Called with the final Y position once rendering completes.
     *
     * @deprecated Prefer the `endY` field of the object `MdTextRender` returns.
     */
    endCursorYHandler?: (y: number) => void;
    security?: RenderSecurityOptions;
};

export type Cursor = { x: number; y: number };

/** Page margins in document units. */
export type PageMargin = {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
};

type FontItem = {
    name: string;
    style: string;
};

/**
 * `RenderOption` after `validateOptions` has filled in every default.
 *
 * `RenderOption` is the permissive shape a caller supplies; this is the
 * complete shape the renderer works with. Keeping them separate means the
 * renderer's assumptions are checked by the compiler rather than upheld by
 * convention, and callers are not forced to supply values the library already
 * has sensible defaults for.
 */
export type ResolvedRenderOption = Omit<
    RenderOption,
    'cursor' | 'page' | 'font' | 'endCursorYHandler'
> & {
    cursor: Cursor;
    page: {
        format?: string | number[];
        unit: jsPDFOptions['unit'];
        orientation?: jsPDFOptions['orientation'];
        margin?: PageMargin;
        maxContentWidth: number;
        maxContentHeight: number;
        lineSpace: number;
        defaultLineHeightFactor: number;
        defaultFontSize: number;
        defaultTitleFontSize: number;
        topmargin: number;
        xpading: number;
        xmargin: number;
        indent: number;
    };
    font: {
        bold: FontItem;
        regular: FontItem;
        light?: FontItem;
        italic: FontItem;
        boldItalic: FontItem;
        code: FontItem;
    };
    breaks: boolean;
    endCursorYHandler: (y: number) => void;
};

/**
 * What a render produced, and what it could not.
 *
 * Returned by `MdTextRender`. `warnings` and `droppedNodes` exist because
 * failures in this library were previously silent — a caller had no way to
 * learn that the document they just generated was missing content.
 */
export interface RenderResult {
    /** Y position of the cursor when rendering finished. */
    endY: number;
    /** Page the render started on — relevant when rendering into an existing document. */
    startPage: number;
    /** Number of pages this render produced, including the one it started on. */
    pageCount: number;
    /** Everything the render could not draw. Empty on a clean render. */
    warnings: RenderWarning[];
    /** Total nodes discarded, summed across the warnings. */
    droppedNodes: number;
    /** Security violations raised during the render. */
    violations: SecurityViolation[];
}
