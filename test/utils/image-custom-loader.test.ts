import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/index';
import { prefetchImages } from '../../src/utils/image-utils';
import { normalizeSecurityOptions } from '../../src/security/security-policy';
import { MdTokenType } from '../../src/enums/mdTokenType';
import { RenderWarnings } from '../../src/store/renderWarnings';
import type { ParsedElement } from '../../src/types/parsedElement';
import type { RenderSecurityOptions } from '../../src/types/security';
import type { ImageLoader } from '../../src/types/renderOption';

/**
 * Issue #87: callers can supply image data through `image.load`, called
 * before the built-in fetch. Returning `undefined` falls back to it.
 */

const PNG_1PX =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const pngBytes = (): Uint8Array =>
    Uint8Array.from(Buffer.from(PNG_1PX.split(',')[1], 'base64'));

const imageElement = (src: string): ParsedElement => ({
    type: MdTokenType.Image,
    src,
});

const permissiveSecurity = (
    overrides: Partial<RenderSecurityOptions> = {},
): RenderSecurityOptions =>
    normalizeSecurityOptions({
        enabled: true,
        blockLocalhost: false,
        blockPrivateIPs: false,
        blockLinkLocalIPs: false,
        blockMetadataIPs: false,
        violationMode: 'skip',
        ...overrides,
    });

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('custom image loader', () => {
    it('uses bytes returned by the loader, converted like fetched images', async () => {
        const load: ImageLoader = vi.fn(async () => pngBytes());
        const nodes = [imageElement('https://example.com/a.png')];

        await prefetchImages(nodes, undefined, undefined, load);

        expect(load).toHaveBeenCalledWith('https://example.com/a.png');
        expect(nodes[0].data).toBe(PNG_1PX);
    });

    it('converts a returned Blob the same way fetched images are converted', async () => {
        const load: ImageLoader = async () =>
            new Blob([pngBytes()], { type: 'image/png' });
        const nodes = [imageElement('https://example.com/a.png')];

        await prefetchImages(nodes, undefined, undefined, load);

        expect(nodes[0].data).toBe(PNG_1PX);
    });

    it('uses a returned string as the data: URL as-is', async () => {
        const load: ImageLoader = async () => PNG_1PX;
        const nodes = [imageElement('https://example.com/a.png')];

        await prefetchImages(nodes, undefined, undefined, load);

        expect(nodes[0].data).toBe(PNG_1PX);
    });

    it('resolves relative paths the built-in fetch cannot parse', async () => {
        // The motivating case from the issue: `[logo](./logo.png)` fails in
        // Node with "Failed to parse URL" unless a loader resolves it.
        const load: ImageLoader = vi.fn(async (src) => {
            expect(src).toBe('./logo.png');
            return pngBytes();
        });
        const nodes = [imageElement('./logo.png')];

        await prefetchImages(nodes, undefined, undefined, load);

        expect(nodes[0].data).toBe(PNG_1PX);
    });

    it('falls back to the built-in fetch when the loader returns undefined', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'image/png' }),
            body: null,
            blob: async () => new Blob([pngBytes()], { type: 'image/png' }),
        }));
        vi.stubGlobal('fetch', fetchMock);
        const load: ImageLoader = vi.fn(async () => undefined);
        const nodes = [imageElement('https://example.com/a.png')];

        await prefetchImages(nodes, undefined, undefined, load);

        expect(load).toHaveBeenCalledWith('https://example.com/a.png');
        expect(fetchMock).toHaveBeenCalled();
        expect(nodes[0].data).toBe(PNG_1PX);
    });

    it('does not call the loader for data: URLs', async () => {
        const load: ImageLoader = vi.fn();
        const nodes = [imageElement(PNG_1PX)];

        await prefetchImages(nodes, undefined, undefined, load);

        expect(load).not.toHaveBeenCalled();
        expect(nodes[0].data).toBe(PNG_1PX);
    });

    it('never calls the loader for a blocked URL', async () => {
        const load: ImageLoader = vi.fn(async () => pngBytes());
        const security = permissiveSecurity({ allowRemoteImages: false });
        const nodes = [imageElement('https://evil.example.com/a.png')];

        await prefetchImages(nodes, security, undefined, load);

        expect(load).not.toHaveBeenCalled();
        expect(nodes[0].data).toBeUndefined();
        expect(nodes[0].src).toBeUndefined();
    });

    it('rejects oversized bytes returned by the loader', async () => {
        const load: ImageLoader = vi.fn(async () => pngBytes());
        const security = permissiveSecurity({ maxImageSizeBytes: 10 });
        const warnings = new RenderWarnings({ logToConsole: false });
        const nodes = [imageElement('https://example.com/a.png')];

        await prefetchImages(nodes, security, warnings, load);

        expect(load).toHaveBeenCalled();
        expect(nodes[0].data).toBeUndefined();
        expect(nodes[0].src).toBeUndefined();
    });

    it('rejects an oversized data: URL string returned by the loader', async () => {
        const load: ImageLoader = async () => PNG_1PX;
        const security = permissiveSecurity({ maxImageSizeBytes: 10 });
        const nodes = [imageElement('https://example.com/a.png')];

        await prefetchImages(nodes, security, undefined, load);

        expect(nodes[0].data).toBeUndefined();
        expect(nodes[0].src).toBeUndefined();
    });

    it('warns and skips the image when the loader throws', async () => {
        const load: ImageLoader = async () => {
            throw new Error('disk exploded');
        };
        const warnings = new RenderWarnings({ logToConsole: false });
        const nodes = [imageElement('https://example.com/a.png')];

        await prefetchImages(nodes, undefined, warnings, load);

        expect(nodes[0].data).toBeUndefined();
        expect(warnings.list().map((w) => w.code)).toEqual([
            'IMAGE_LOAD_FAILED',
        ]);
    });
});

describe('image.load through MdTextRender', () => {
    it('threads options.image.load through to image loading', async () => {
        const load: ImageLoader = vi.fn(async () => pngBytes());
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });

        const result = await MdTextRender(doc, '![logo](./logo.png)', {
            silent: true,
            font: {
                regular: { name: 'helvetica', style: 'normal' },
                bold: { name: 'helvetica', style: 'bold' },
            },
            image: { load },
        });

        expect(load).toHaveBeenCalledWith('./logo.png');
        expect(
            result.warnings.filter((w) => w.code === 'IMAGE_LOAD_FAILED'),
        ).toEqual([]);
    });
});
