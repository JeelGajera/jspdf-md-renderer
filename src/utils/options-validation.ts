import { RenderOption } from '../types/renderOption';

const DEFAULT_HEADING_SIZES: Partial<NonNullable<RenderOption['heading']>> = {
    h1: 24,
    h2: 20,
    h3: 17,
    h4: 15,
    h5: 13,
    h6: 12,
    bottomSpacing: 2,
};

const DEFAULT_FONT = {
    bold: { name: 'helvetica', style: 'bold' },
    regular: { name: 'helvetica', style: 'normal' },
    light: { name: 'helvetica', style: 'light' },
    italic: { name: 'helvetica', style: 'italic' },
    boldItalic: { name: 'helvetica', style: 'bolditalic' },
    code: { name: 'courier', style: 'normal' },
};

const DEFAULT_PAGE = {
    format: 'a4',
    unit: 'mm',
    orientation: 'portrait',
    maxContentWidth: 190,
    maxContentHeight: 277,
    lineSpace: 3,
    defaultLineHeightFactor: 1.4,
    defaultFontSize: 11,
    defaultTitleFontSize: 14,
    topmargin: 10,
    xpading: 10,
    xmargin: 10,
    indent: 8,
};

export const validateOptions = (options: RenderOption): RenderOption => {
    if (!options)
        throw new Error('[jspdf-md-renderer] RenderOption is required');

    // Page validation
    const page = { ...DEFAULT_PAGE, ...options.page };
    if (page.maxContentWidth <= 0)
        throw new Error('[jspdf-md-renderer] page.maxContentWidth must be > 0');
    if (page.maxContentHeight <= 0)
        throw new Error(
            '[jspdf-md-renderer] page.maxContentHeight must be > 0',
        );
    if (page.indent < 0)
        throw new Error('[jspdf-md-renderer] page.indent must be >= 0');
    if (page.defaultFontSize < 1)
        throw new Error(
            '[jspdf-md-renderer] page.defaultFontSize must be >= 1',
        );
    if (page.defaultLineHeightFactor < 1) page.defaultLineHeightFactor = 1.4;

    // Font validation
    if (!options.font?.regular?.name) {
        throw new Error('[jspdf-md-renderer] font.regular.name is required');
    }
    const font = { ...DEFAULT_FONT, ...options.font };
    if (!font.bold?.name) font.bold = DEFAULT_FONT.bold;
    if (!font.italic?.name) font.italic = DEFAULT_FONT.italic;
    if (!font.boldItalic?.name) font.boldItalic = DEFAULT_FONT.boldItalic;
    if (!font.code?.name) font.code = DEFAULT_FONT.code;

    // Heading scale validation
    const heading = { ...DEFAULT_HEADING_SIZES, ...(options.heading ?? {}) };
    // Clamp all heading sizes to sane range
    (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).forEach((k) => {
        if ((heading[k] ?? 0) < 6 || (heading[k] ?? 0) > 72)
            heading[k] = DEFAULT_HEADING_SIZES[k];
    });

    // Codespan defaults
    const codespan = {
        backgroundColor: '#EEEEEE',
        padding: 0.8,
        showBackground: true,
        fontSizeScale: 0.88,
        ...(options.codespan ?? {}),
    };

    // Blockquote defaults
    const blockquote = {
        barColor: '#AAAAAA',
        barWidth: 1,
        paddingLeft: 4,
        ...(options.blockquote ?? {}),
    };

    // List defaults
    const list = {
        bulletChar: '\u2022 ',
        indentSize: page.indent,
        itemSpacing: 0,
        ...(options.list ?? {}),
    };

    // Paragraph defaults
    const paragraph = {
        bottomSpacing: page.lineSpace,
        ...(options.paragraph ?? {}),
    };

    // CodeBlock defaults
    const codeBlock = {
        backgroundColor: '#F6F8FA',
        borderColor: '#E1E4E8',
        borderRadius: 2,
        padding: 4,
        fontSizeScale: 0.9,
        showLanguageLabel: true,
        ...(options.codeBlock ?? {}),
    };
    const spacing = {
        afterHeading: 2,
        afterParagraph: 3,
        afterCodeBlock: 3,
        afterBlockquote: 3,
        afterImage: 2,
        afterHR: 2,
        betweenListItems: 0,
        afterList: 3,
        afterTable: 3,
        ...(options.spacing ?? {}),
    };
    (
        [
            'afterHeading',
            'afterParagraph',
            'afterCodeBlock',
            'afterBlockquote',
            'afterImage',
            'afterHR',
            'betweenListItems',
            'afterList',
            'afterTable',
        ] as const
    ).forEach((key) => {
        if ((spacing[key] ?? 0) < 0) spacing[key] = 0;
    });
    if ((heading.bottomSpacing ?? 0) < 0) heading.bottomSpacing = 0;
    if ((paragraph.bottomSpacing ?? 0) < 0) paragraph.bottomSpacing = 0;
    if ((blockquote.bottomSpacing ?? 0) < 0) blockquote.bottomSpacing = 0;

    // Image defaults
    const image = {
        defaultAlign: 'left' as const,
        ...(options.image ?? {}),
    };

    // endCursorYHandler must exist
    const endCursorYHandler = options.endCursorYHandler ?? (() => {});

    return {
        ...options,
        page,
        font,
        heading,
        codespan,
        blockquote,
        list,
        paragraph,
        codeBlock,
        spacing,
        image,
        endCursorYHandler,
    } as RenderOption;
};
