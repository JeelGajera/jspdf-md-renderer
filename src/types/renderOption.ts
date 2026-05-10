import jsPDF, { jsPDFOptions } from 'jspdf';
import { UserOptions } from 'jspdf-autotable';

export type RenderOption = {
    cursor: {
        x: number;
        y: number;
    };
    page: {
        format?: string | number[];
        unit: jsPDFOptions['unit'];
        orientation?: jsPDFOptions['orientation'];
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
        light: FontItem;
        code?: FontItem;
    };
    heading?: {
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
        /** Vertical space between list items. Default: 0 */
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
    pageBreakHandler?: (doc: jsPDF) => void;
    endCursorYHandler: (y: number) => void;
};

export type Cursor = { x: number; y: number };

type FontItem = {
    name: string;
    style: string;
};
