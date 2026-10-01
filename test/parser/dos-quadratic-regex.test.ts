import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextParser } from '../../src/parser/MdTextParser';
import { MdTextRender } from '../../src/renderer/MdTextRender';
import { calculateImageDimensions } from '../../src/utils/image-utils';

/**
 * Each input below is shaped to make one of the regexes this library used to
 * run over attacker-controlled text backtrack from every position. On 4.3.0
 * these took tens of seconds; the bound leaves wide headroom for slow CI while
 * still failing on quadratic behaviour.
 */
const LIMIT_MS = 2000;
const SIZE = 200_000;

const options = {
    font: { regular: { name: 'helvetica', style: 'normal' } },
    silent: true,
};

const timed = async (fn: () => Promise<unknown> | unknown): Promise<number> => {
    const started = Date.now();
    await fn();
    return Date.now() - started;
};

describe('linear-time handling of crafted markdown', () => {
    it('strips an HTML block full of unclosed tags', async () => {
        const elapsed = await timed(() =>
            MdTextParser('<div\n' + '<'.repeat(SIZE)),
        );
        expect(elapsed).toBeLessThan(LIMIT_MS);
    });

    it('strips an HTML block full of unterminated comments', async () => {
        const elapsed = await timed(() =>
            MdTextParser('<!--' + '<!--'.repeat(SIZE / 4)),
        );
        expect(elapsed).toBeLessThan(LIMIT_MS);
    });

    it('matches an HTML block with a very long tag name', async () => {
        const elapsed = await timed(() =>
            MdTextParser('<' + 'a'.repeat(SIZE) + '>'),
        );
        expect(elapsed).toBeLessThan(LIMIT_MS);
    });

    it('trims a code block ending in a long whitespace run', async () => {
        const markdown = '```\n' + ' '.repeat(SIZE) + 'x\n```';
        const elapsed = await timed(() =>
            MdTextRender(new jsPDF(), markdown, options),
        );
        expect(elapsed).toBeLessThan(LIMIT_MS);
    });

    it('sizes a data URL with a long run of padding characters', async () => {
        const markdown =
            '![a](data:image/png;base64,' + '='.repeat(SIZE) + 'x)';
        const elapsed = await timed(() =>
            MdTextRender(new jsPDF(), markdown, options),
        );
        expect(elapsed).toBeLessThan(LIMIT_MS);
    });

    it('reads SVG dimensions from many unclosed <svg tags', async () => {
        const markdown =
            '![a](data:image/svg+xml,' + '%3Csvg%20'.repeat(SIZE / 5) + ')';
        const elapsed = await timed(() =>
            MdTextRender(new jsPDF(), markdown, options),
        );
        expect(elapsed).toBeLessThan(LIMIT_MS);
    });
});

describe('HTML handling is unchanged by the linear-time rewrite', () => {
    it('maps a whole <strong> block to bold text', async () => {
        const [node] = await MdTextParser('<strong>\nbold\n</strong>');
        expect(node).toEqual({ type: 'strong', content: '\nbold\n' });
    });

    it('matches the closing tag case-insensitively', async () => {
        const [node] = await MdTextParser('<b class="x">\nt\n</B>');
        expect(node).toEqual({ type: 'strong', content: '\nt\n' });
    });

    it('removes comments and tags from unknown HTML', async () => {
        const [node] = await MdTextParser(
            '<div>\n<b>x</b> <!-- c > d --> y\n</div>',
        );
        expect(node).toEqual({ type: 'raw', content: 'x  y' });
    });

    it('keeps an unterminated comment as text', async () => {
        const [node] = await MdTextParser('<!-- open');
        expect(node).toEqual({ type: 'raw', content: '<!-- open' });
    });
});

describe('SVG dimensions are unchanged by the linear-time rewrite', () => {
    const doc = new jsPDF({ unit: 'px' });
    const size = (svg: string) => {
        const { finalWidth, finalHeight } = calculateImageDimensions(
            doc,
            { type: 'image', data: 'data:image/svg+xml,' + encodeURIComponent(svg) },
            1e6,
            1e6,
            'px',
        );
        return [finalWidth, finalHeight];
    };

    it('reads width and height from the root tag', () => {
        expect(size('<svg width="120" height="40px"></svg>')).toEqual([120, 40]);
    });

    it('falls back to the viewBox', () => {
        expect(size("<svg viewBox='0 0 30 45'><g/></svg>")).toEqual([30, 45]);
    });

    it('uses the first <svg> tag that declares the attribute', () => {
        expect(
            size('<svg><svg width="7" height="9"></svg></svg>'),
        ).toEqual([7, 9]);
    });
});
