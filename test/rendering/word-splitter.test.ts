import { describe, expect, it } from 'vitest';
import { RenderStore } from '../../src/store/renderStore';
import { applyStyleToDoc } from '../../src/layout/wordSplitter';
import { createRenderOptions } from '../helpers/renderOptions';
import { MockDoc } from '../helpers/mockDoc';

describe('applyStyleToDoc', () => {
    it('draws unstyled text with font.regular.style', () => {
        const doc = new MockDoc();
        const opts = createRenderOptions({
            font: {
                bold: { name: 'helvetica', style: 'bold' },
                regular: { name: 'times', style: 'italic' },
                light: { name: 'helvetica', style: 'normal' },
            },
        });
        const store = new RenderStore(opts);

        applyStyleToDoc(doc as never, 'normal', store);

        expect(doc.setFontCalls.at(-1)).toEqual({ name: 'times', style: 'italic' });
    });

    it('falls back to normal when font.regular.style is unset', () => {
        const doc = new MockDoc();
        const opts = createRenderOptions({
            font: {
                bold: { name: 'helvetica', style: 'bold' },
                regular: { name: 'helvetica', style: '' },
                light: { name: 'helvetica', style: 'normal' },
            },
        });
        const store = new RenderStore(opts);

        applyStyleToDoc(doc as never, 'normal', store);

        expect(doc.setFontCalls.at(-1)).toEqual({ name: 'helvetica', style: 'normal' });
    });
});
