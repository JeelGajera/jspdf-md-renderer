import { describe, expect, it, vi } from 'vitest';
import { MdTokenType } from '../../src/enums/mdTokenType';
import { RenderStore } from '../../src/store/renderStore';
import renderParagraph from '../../src/renderer/components/paragraph';
import renderBlockquote from '../../src/renderer/components/blockquote';
import renderCodeBlock from '../../src/renderer/components/code';
import renderHR from '../../src/renderer/components/hr';
import renderImage from '../../src/renderer/components/image';
import renderRawItem from '../../src/renderer/components/rawItem';
import { createRenderOptions } from '../helpers/renderOptions';
import { MockDoc } from '../helpers/mockDoc';

vi.mock('../../src/layout', () => ({
    renderInlineContent: vi.fn((_doc, _elements, _x, _y, _maxWidth, store) => {
        store.updateY(5, 'add');
    }),
    renderPlainText: vi.fn((_doc, _text, _x, _y, _maxWidth, store) => {
        store.updateY(5, 'add');
    }),
}));

describe('renderer components', () => {
    it('paragraph delegates single image item to parent renderer', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions());
        const parentRenderer = vi.fn();
        const paragraph = {
            type: MdTokenType.Paragraph,
            items: [{ type: MdTokenType.Image, data: 'data:image/png;base64,AA==' }],
        };

        renderParagraph(doc as never, paragraph, 0, store, parentRenderer);
        expect(parentRenderer).toHaveBeenCalledTimes(1);
        expect(parentRenderer.mock.calls[0][0].type).toBe(MdTokenType.Image);
    });

    it('paragraph flushes mixed inline and block items in order', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions());
        const parentRenderer = vi.fn();
        const paragraph = {
            type: MdTokenType.Paragraph,
            items: [
                { type: MdTokenType.Text, content: 'inline' },
                { type: MdTokenType.Code, code: 'block code' },
                { type: MdTokenType.Text, content: 'tail' },
            ],
        };

        renderParagraph(doc as never, paragraph, 0, store, parentRenderer);
        expect(parentRenderer).toHaveBeenCalledTimes(1);
        expect(parentRenderer.mock.calls[0][0].type).toBe(MdTokenType.Code);
    });

    it('blockquote draws quote bar and optional background across pages', () => {
        const doc = new MockDoc();
        const store = new RenderStore(
            createRenderOptions({
                blockquote: { backgroundColor: '#F0F0F0', barWidth: 1 },
            }),
        );
        const element = {
            type: MdTokenType.Blockquote,
            items: [{ type: MdTokenType.Text, content: 'a' }, { type: MdTokenType.Text, content: 'b' }],
        };
        const renderElement = vi
            .fn()
            .mockImplementationOnce(() => {
                store.updateY(8, 'add');
                store.recordContentY();
            })
            .mockImplementationOnce(() => {
                doc.addPage();
                store.updateY(store.options.page.topmargin, 'set');
                store.updateY(12, 'add');
                store.recordContentY();
            });

        renderBlockquote(doc as never, element, 0, store, renderElement);
        expect(doc.setPageCalls).toContain(1);
        expect(doc.setPageCalls).toContain(2);
        expect(doc.lineCalls.length).toBeGreaterThanOrEqual(2);
        expect(doc.rectCalls.length).toBeGreaterThan(0);
    });

    it('code block renders language label and advances cursor', () => {
        const doc = new MockDoc();
        const store = new RenderStore(
            createRenderOptions({
                codeBlock: {
                    showLanguageLabel: true,
                    fontSizeScale: 0.9,
                    padding: 2,
                },
            }),
        );
        const startY = store.Y;

        renderCodeBlock(
            doc as never,
            {
                type: MdTokenType.Code,
                lang: 'ts',
                code: 'const a = 1;\nconst b = 2;',
            },
            0,
            store,
        );

        expect(doc.roundedRectCalls.length).toBeGreaterThan(0);
        expect(doc.textCalls.some((c) => c.text === 'ts')).toBe(true);
        expect(store.Y).toBeGreaterThan(startY);
    });

    it('horizontal rule draws line and advances y', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions());
        const startY = store.Y;

        renderHR(doc as never, store);

        expect(doc.lineCalls.length).toBe(1);
        expect(store.Y).toBeGreaterThan(startY);
    });

    it('image renderer aligns center/right and adds image', () => {
        const doc = new MockDoc();
        const store = new RenderStore(
            createRenderOptions({
                image: { defaultAlign: 'right' },
            }),
        );
        const startY = store.Y;

        renderImage(
            doc as never,
            {
                type: MdTokenType.Image,
                data: 'data:image/png;base64,AA==',
                width: 120,
                height: 60,
            },
            0,
            store,
        );

        expect(doc.addImageCalls.length).toBe(1);
        expect(store.Y).toBeGreaterThan(startY);
    });

    it('raw item handles whitespace-only content without bullet', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions());
        const startY = store.Y;

        renderRawItem(
            doc as never,
            { type: MdTokenType.Raw, content: '\n\n\n' },
            0,
            store,
            false,
            vi.fn(),
            1,
            false,
            false,
        );

        expect(store.Y).toBeGreaterThan(startY);
    });
});
