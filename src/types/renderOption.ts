export type RenderOption = {
    cursor: {
        x: number;
        y: number;
    };
    page: {
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
    content: {
        textAlignment: "left" | "right" | "justify"
    };
    pageBreakHandler: () => void;
    endCursorYHandler: (y: number) => void;
};

type FontItem = {
    name: string;
    style: string;
};
