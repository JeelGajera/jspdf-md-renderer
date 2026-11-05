import { describe, expect, it, vi } from 'vitest';

import { getDocUnit } from '../../src/utils/doc-helpers';
import { pxToDocUnit } from '../../src/utils/image-utils';

const PNG_1PX =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('getDocUnit', () => {
    it('recovers the unit jsPDF was created with from its scale factor', async () => {
        const { jsPDF } = await import('jspdf');

        const expectUnit = (unit: string, expected: string) => {
            expect(getDocUnit(new jsPDF({ unit }) as never)).toBe(expected);
        };

        expectUnit('pt', 'pt');
        expectUnit('mm', 'mm');
        expectUnit('cm', 'cm');
        expectUnit('in', 'in');
        expectUnit('pc', 'pc');
        expectUnit('px', 'px');
    });

    it('returns null when the scale factor is missing', () => {
        expect(getDocUnit({ internal: {} } as never)).toBeNull();
        expect(getDocUnit({} as never)).toBeNull();
    });
});

describe('pxToDocUnit', () => {
    it('converts 96 px to one inch in every unit', () => {
        // 96 px at 96 DPI is exactly one inch.
        expect(pxToDocUnit(96, 'pt')).toBeCloseTo(72);
        expect(pxToDocUnit(96, 'in')).toBeCloseTo(1);
        expect(pxToDocUnit(96, 'cm')).toBeCloseTo(2.54);
        expect(pxToDocUnit(96, 'pc')).toBeCloseTo(6);
        expect(pxToDocUnit(96, 'mm')).toBeCloseTo(25.4);
        expect(pxToDocUnit(96, 'px')).toBe(96);
    });
});

describe('image sizing honours the document unit', () => {
    const render = async (unit: string) => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit, format: 'a4' });
        const addImage = vi.spyOn(doc, 'addImage');

        await MdTextRender(doc, `![x](${PNG_1PX}){width=96 height=96}`, {
            page: { margin: { top: 1, right: 1, bottom: 1, left: 1 } },
            font: { regular: { name: 'helvetica', style: 'normal' } },
            silent: true,
        });

        const [, , , , width, height] = addImage.mock.calls[0];
        addImage.mockRestore();
        return { width, height };
    };

    it('draws a 96 px image one inch wide in a pt document', async () => {
        const { width, height } = await render('pt');
        // 96 px at 96 DPI = 1 inch = 72 pt. Before the fix this was 25.4 pt.
        expect(width).toBeCloseTo(72);
        expect(height).toBeCloseTo(72);
    });

    it('draws a 96 px image one inch wide in a cm document', async () => {
        const { width, height } = await render('cm');
        expect(width).toBeCloseTo(2.54);
        expect(height).toBeCloseTo(2.54);
    });

    it('keeps millimetre documents unchanged', async () => {
        const { width, height } = await render('mm');
        expect(width).toBeCloseTo(25.4);
        expect(height).toBeCloseTo(25.4);
    });
});
