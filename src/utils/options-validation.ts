import { RenderOption } from '../types/renderOption';

const defaultOptions: Partial<RenderOption> = {
    page: {
        indent: 10,
        maxContentWidth: 190,
        maxContentHeight: 277,
        lineSpace: 1.5,
        defaultLineHeightFactor: 1.2,
        defaultFontSize: 12,
        defaultTitleFontSize: 14,
        topmargin: 10,
        xpading: 10,
        xmargin: 10,
        format: 'a4',
        orientation: 'p',
    },
    font: {
        bold: { name: 'helvetica', style: 'bold' },
        regular: { name: 'helvetica', style: 'normal' },
        light: { name: 'helvetica', style: 'light' },
    },
};

export const validateOptions = (options: RenderOption): RenderOption => {
    if (!options) {
        throw new Error('RenderOption is required');
    }

    // Merge defaults
    const mergedPage = { ...defaultOptions.page, ...options.page };
    const mergedFont = { ...defaultOptions.font, ...options.font };

    // Ensure critical defaults if missing
    if (!mergedPage.maxContentWidth) mergedPage.maxContentWidth = 190;
    if (!mergedPage.maxContentHeight) mergedPage.maxContentHeight = 277;

    return {
        ...options,
        page: mergedPage,
        font: mergedFont,
    } as RenderOption;
};
