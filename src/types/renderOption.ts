import jsPDF, { jsPDFOptions } from 'jspdf';
import { UserOptions } from 'jspdf-autotable';

export type RenderOption = {
    cursor: {
        x: number;
        y: number;
    };
    page: {
        format?: string | number[];
        unit?: jsPDFOptions['unit'];
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
    pageBreakHandler?: (doc: jsPDF) => void;
    endCursorYHandler: (y: number) => void;
};

export type Cursor = { x: number; y: number };

type FontItem = {
    name: string;
    style: string;
};
