import { describe, expect, it } from 'vitest';
import {
    breakIntoLines,
    flattenToWords,
    renderInlineContent,
    renderLine,
} from '../../src/layout/layoutEngine';
import { resolveStyle } from '../../src/layout/wordSplitter';
import { RenderStore } from '../../src/store/renderStore';
import { MdTokenType } from '../../src/enums/mdTokenType';
import { StyledLine } from '../../src/types/styledWordInfo';
import { createRenderOptions } from '../helpers/renderOptions';
import { MockDoc } from '../helpers/mockDoc';

describe('layout engine', () => {
    it('resolves nested style combinations', () => {
        expect(resolveStyle('strong', 'italic')).toBe('bolditalic');
        expect(resolveStyle('em', 'bold')).toBe('bolditalic');
        expect(resolveStyle('codespan', 'normal')).toBe('codespan');
        expect(resolveStyle('text', 'italic')).toBe('italic');
    });

    it('flattens mixed elements and preserves links/images/line breaks', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions());
        const words = flattenToWords(
            doc as never,
            [
                {
                    type: MdTokenType.Link,
                    href: 'https://example.com',
                    items: [
                        { type: MdTokenType.Text, content: 'hello world' },
                        {
                            type: MdTokenType.Image,
                            data: 'data:image/png;base64,AA==',
                            width: 40,
                            height: 20,
                        },
                    ],
                },
                { type: MdTokenType.Br },
                { type: MdTokenType.CodeSpan, content: '  code  ' },
            ],
            store,
        );

        expect(words.some((w) => w.isLink && w.href === 'https://example.com')).toBe(
            true,
        );
        expect(words.some((w) => w.isImage)).toBe(true);
        expect(words.some((w) => w.isBr)).toBe(true);
        expect(words.some((w) => w.style === 'codespan' && w.text === 'code')).toBe(
            true,
        );
    });

    it('breaks oversized words into multiple chunks', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions());
        const words = flattenToWords(
            doc as never,
            [{ type: MdTokenType.Text, content: 'supercalifragilisticexpialidocious' }],
            store,
        );

        const lines = breakIntoLines(doc as never, words, 10, store);
        expect(lines.length).toBeGreaterThan(1);
        expect(lines[0].words[0].text.length).toBeGreaterThan(0);
    });

    it('renders links and inline images within a line', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions());
        const line: StyledLine = {
            words: [
                {
                    text: 'A',
                    width: 2,
                    style: 'normal',
                    hasTrailingSpace: true,
                    isLink: true,
                    href: 'https://example.com',
                    linkColor: [0, 0, 255],
                },
                {
                    text: '',
                    width: 10,
                    style: 'normal',
                    isImage: true,
                    imageHeight: 5,
                    imageElement: {
                        type: MdTokenType.Image,
                        data: 'data:image/png;base64,AA==',
                    },
                },
            ],
            totalTextWidth: 12,
            isLastLine: false,
            lineHeight: 10,
        };

        renderLine(doc as never, line, 10, 10, 100, store, 'justify');
        expect(doc.links.length).toBe(1);
        expect(doc.addImageCalls.length).toBe(1);
    });

    it('renders inline content with trimLastLine and updates cursor', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions());
        const startY = store.Y;

        const endY = renderInlineContent(
            doc as never,
            [{ type: MdTokenType.Text, content: 'alpha beta gamma' }],
            store.X,
            store.Y,
            60,
            store,
            { trimLastLine: true },
        );

        expect(endY).toBeGreaterThan(startY);
        expect(store.Y).toBeGreaterThan(startY);
        expect(store.X).toBeGreaterThanOrEqual(store.options.page.xpading);
    });
});
