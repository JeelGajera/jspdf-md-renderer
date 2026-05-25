import { RenderOption } from '../../src/types/renderOption';
import { validateOptions } from '../../src/utils/options-validation';

export const createRenderOptions = (
    overrides: Partial<RenderOption> = {},
): RenderOption => {
    const options: RenderOption = {
        cursor: { x: 10, y: 10 },
        page: {
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
        },
        font: {
            bold: { name: 'helvetica', style: 'bold' },
            regular: { name: 'helvetica', style: 'normal' },
            light: { name: 'helvetica', style: 'normal' },
        },
        content: {
            textAlignment: 'left',
        },
        endCursorYHandler: () => {},
        ...overrides,
    };
    return validateOptions(options);
};
