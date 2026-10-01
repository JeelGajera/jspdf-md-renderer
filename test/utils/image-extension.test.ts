import { describe, expect, it } from 'vitest';
import { takeImageAttributes } from '../../src/parser/imageExtension';
import { MdTextParser } from '../../src/parser/MdTextParser';
import { RenderWarnings } from '../../src/store/renderWarnings';
import { ParsedElement } from '../../src/types/parsedElement';

/** Every image node in a parsed tree, in document order. */
const imagesIn = (nodes: ParsedElement[]): ParsedElement[] =>
    nodes.flatMap((node) => [
        ...(node.type === 'image' ? [node] : []),
        ...imagesIn(node.items ?? []),
        ...imagesIn(node.header ?? []),
        ...(node.rows ?? []).flatMap(imagesIn),
    ]);

describe('imageExtension parser hardening', () => {
    it('parses valid width/height/align attributes', () => {
        const taken = takeImageAttributes(
            '{width=200 height=150 align=center} after',
        );

        expect(taken?.attrs).toEqual({
            width: 200,
            height: 150,
            align: 'center',
        });
        expect(taken?.rest).toBe(' after');
    });

    it('returns null when the text does not start with an attribute block', () => {
        expect(takeImageAttributes(' plain text')).toBeNull();
        expect(takeImageAttributes('{}')).toBeNull();
        expect(takeImageAttributes('{unterminated width=5')).toBeNull();
    });

    it('skips oversized attribute blocks without hanging', () => {
        const warnings = new RenderWarnings({ logToConsole: false });
        const longAttrs = `width=200 ${'k='.repeat(400)}`;

        const started = Date.now();
        const taken = takeImageAttributes(`{${longAttrs}}`, warnings);
        const elapsed = Date.now() - started;

        expect(elapsed).toBeLessThan(100);
        expect(taken?.attrs).toEqual({});

        // The image still renders, so the dropped sizing must be reported or
        // the only symptom is a picture at the wrong size.
        const reported = warnings.list();
        expect(reported).toHaveLength(1);
        expect(reported[0].code).toBe('IMAGE_ATTRS_IGNORED');
    });

    it('reports ignored attributes on the render result', async () => {
        const { MdTextRender } = await import('../../src/index');
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const longAttrs = `width=200 ${'k='.repeat(400)}`;

        const result = await MdTextRender(
            doc,
            `![alt](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==){${longAttrs}}`,
            {
                page: { margin: { top: 10, right: 10, bottom: 10, left: 10 } },
                font: { regular: { name: 'helvetica', style: 'normal' } },
                silent: true,
            },
        );

        expect(
            result.warnings.some((w) => w.code === 'IMAGE_ATTRS_IGNORED'),
        ).toBe(true);
    });
});

describe('image attributes in parsed markdown', () => {
    it('applies attributes wherever an image can appear', async () => {
        const markdown = [
            '![a](a.png){width=10}',
            '',
            'Text ![b](b.png){h=20 align=right} after',
            '',
            '- item ![c](c.png){w=30}',
            '',
            '| col |',
            '|-----|',
            '| ![d](d.png){align=center} |',
            '',
            '[![e](e.png){width=50}](https://example.com)',
            '',
            '> ![f](f.png) {width=60}',
        ].join('\n');

        const images = imagesIn(await MdTextParser(markdown));

        expect(
            images.map(({ src, width, height, align }) => ({
                src,
                width,
                height,
                align,
            })),
        ).toEqual([
            { src: 'a.png', width: 10, height: undefined, align: undefined },
            { src: 'b.png', width: undefined, height: 20, align: 'right' },
            { src: 'c.png', width: 30, height: undefined, align: undefined },
            { src: 'd.png', width: undefined, height: undefined, align: 'center' },
            { src: 'e.png', width: 50, height: undefined, align: undefined },
            { src: 'f.png', width: 60, height: undefined, align: undefined },
        ]);
    });

    it('keeps a lone image with attributes as a single block image', async () => {
        const [paragraph] = await MdTextParser('![a](a.png){width=10}');

        expect(paragraph.items).toHaveLength(1);
        expect(paragraph.items?.[0]).toMatchObject({
            type: 'image',
            width: 10,
        });
    });

    it('keeps the text that follows the attribute block', async () => {
        const [paragraph] = await MdTextParser('![a](a.png){w=5} and more');

        expect(paragraph.items?.[1]).toMatchObject({
            type: 'text',
            content: ' and more',
        });
    });

    it('leaves attribute syntax inside a fenced code block untouched', async () => {
        const source = '![logo](logo.png){width=100}';
        const [code] = await MdTextParser('```md\n' + source + '\n```');

        expect(code.code).toBe(source);
    });

    it('leaves attribute syntax inside a code span untouched', async () => {
        const [paragraph] = await MdTextParser(
            'Write `![a](b.png){w=5}` to size an image',
        );

        expect(paragraph.items?.[1]).toMatchObject({
            type: 'codespan',
            content: '![a](b.png){w=5}',
        });
    });

    it('applies attributes to an image that has a title', async () => {
        const [paragraph] = await MdTextParser(
            '![alt](https://x.test/a.png "Title"){width=100}',
        );

        expect(paragraph.items).toHaveLength(1);
        expect(paragraph.items?.[0]).toMatchObject({
            type: 'image',
            src: 'https://x.test/a.png',
            width: 100,
        });
    });

    it('treats an escaped brace as literal text', async () => {
        const [paragraph] = await MdTextParser('![a](a.png)\\{width=10}');

        expect(paragraph.items?.[0]).toMatchObject({
            type: 'image',
            width: undefined,
        });
    });

    it('reports an oversized attribute block on a nested image', async () => {
        const warnings = new RenderWarnings({ logToConsole: false });
        await MdTextParser(
            `- item ![a](a.png){width=1 ${'k='.repeat(300)}}`,
            warnings,
        );

        expect(warnings.list().map((w) => w.code)).toEqual([
            'IMAGE_ATTRS_IGNORED',
        ]);
    });

    it('parses adversarial image syntax in linear time', async () => {
        // 200 KB of unterminated image openers took ~15 s with the previous
        // whole-document regex, which backtracked from every `![`.
        const started = Date.now();
        await MdTextParser('!['.repeat(100_000));

        expect(Date.now() - started).toBeLessThan(2000);
    });
});
