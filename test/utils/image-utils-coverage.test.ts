import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import {
    blobToDataUrl,
    calculateImageDimensions,
    detectImageFormat,
    prefetchImages,
    pxToDocUnit,
    secureImageFetch,
} from '../../src/utils/image-utils';
import { normalizeSecurityOptions } from '../../src/security/security-policy';
import { MdTokenType } from '../../src/enums/mdTokenType';
import { RenderWarnings } from '../../src/store/renderWarnings';
import type { ParsedElement } from '../../src/types/parsedElement';
import type { RenderSecurityOptions } from '../../src/types/security';

/**
 * Issue #91: the coverage thresholds in the Vitest config were commented
 * out, and `src/utils/image-utils.ts` sat at ~75% line coverage. These tests
 * exercise the paths the Node run never reached: the SVG sizing fallbacks,
 * `data:` URL edge cases, the `FileReader` fallback in `blobToDataUrl`, the
 * browser-only SVG rasterisation path (behind mocked browser globals), and
 * the remaining `secureImageFetch`/`readImageBlob` error branches.
 */

const PNG_1PX =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const svgDataUrl = (svg: string): string =>
    `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;

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

let realBuffer: typeof Buffer | undefined;
let realTextEncoder: typeof TextEncoder | undefined;

const hideBuffer = (): void => {
    realBuffer = globalThis.Buffer;
    (globalThis as any).Buffer = undefined;
};

const hideTextEncoder = (): void => {
    realTextEncoder = globalThis.TextEncoder;
    (globalThis as any).TextEncoder = undefined;
};

afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ['window', 'document', 'Image', 'FileReader'] as const) {
        delete (globalThis as any)[key];
    }
    if (realBuffer !== undefined) {
        (globalThis as any).Buffer = realBuffer;
        realBuffer = undefined;
    }
    if (realTextEncoder !== undefined) {
        (globalThis as any).TextEncoder = realTextEncoder;
        realTextEncoder = undefined;
    }
});

describe('pxToDocUnit', () => {
    it('converts pixels to each document unit at 96 DPI', () => {
        expect(pxToDocUnit(96, 'mm')).toBeCloseTo(25.4, 10);
        expect(pxToDocUnit(96, 'pt')).toBe(72);
        expect(pxToDocUnit(96, 'in')).toBe(1);
        expect(pxToDocUnit(96, 'px')).toBe(96);
        expect(pxToDocUnit(96)).toBeCloseTo(25.4, 10);
        expect(pxToDocUnit(96, 'furlong')).toBeCloseTo(25.4, 10);
    });
});

describe('detectImageFormat', () => {
    it('detects the format from a data URI prefix', () => {
        const format = (data: string) =>
            detectImageFormat({ type: MdTokenType.Image, data });
        expect(format('data:image/png;base64,AAA')).toBe('PNG');
        expect(format('data:image/jpeg;base64,AAA')).toBe('JPEG');
        expect(format('data:image/jpg;base64,AAA')).toBe('JPEG');
        expect(format('data:image/webp;base64,AAA')).toBe('WEBP');
        expect(format('data:image/gif;base64,AAA')).toBe('GIF');
    });

    it('falls back to the src extension, ignoring queries and hashes', () => {
        const format = (src: string) =>
            detectImageFormat({ type: MdTokenType.Image, src });
        expect(format('https://x.test/a.PNG?v=2#frag')).toBe('PNG');
        expect(format('https://x.test/a.JPG')).toBe('JPEG');
        expect(format('https://x.test/a.webp')).toBe('WEBP');
    });

    it('defaults to JPEG when nothing matches', () => {
        expect(
            detectImageFormat({
                type: MdTokenType.Image,
                src: 'https://x.test/a.bmp',
            }),
        ).toBe('JPEG');
        expect(detectImageFormat({ type: MdTokenType.Image })).toBe('JPEG');
    });
});

describe('calculateImageDimensions', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    it('returns zero dimensions when the element has no data', () => {
        expect(
            calculateImageDimensions(
                doc,
                { type: MdTokenType.Image },
                100,
                100,
                'mm',
            ),
        ).toEqual({ finalWidth: 0, finalHeight: 0 });
    });

    it('honors explicit width and height in the document unit', () => {
        const { finalWidth, finalHeight } = calculateImageDimensions(
            doc,
            {
                type: MdTokenType.Image,
                data: PNG_1PX,
                naturalWidth: 100,
                naturalHeight: 50,
                width: 72,
                height: 36,
            },
            1000,
            1000,
            'pt',
        );
        expect(finalWidth).toBe(54);
        expect(finalHeight).toBe(27);
    });

    it('derives the missing side from the aspect ratio', () => {
        const byWidth = calculateImageDimensions(
            doc,
            {
                type: MdTokenType.Image,
                data: PNG_1PX,
                naturalWidth: 100,
                naturalHeight: 50,
                width: 96,
            },
            1000,
            1000,
            'mm',
        );
        expect(byWidth.finalWidth).toBeCloseTo(25.4, 10);
        expect(byWidth.finalHeight).toBeCloseTo(12.7, 10);

        const byHeight = calculateImageDimensions(
            doc,
            {
                type: MdTokenType.Image,
                data: PNG_1PX,
                naturalWidth: 100,
                naturalHeight: 50,
                height: 48,
            },
            1000,
            1000,
            'mm',
        );
        expect(byHeight.finalHeight).toBeCloseTo(12.7, 10);
        expect(byHeight.finalWidth).toBeCloseTo(25.4, 10);
    });

    it('clamps oversized images into the available box', () => {
        const wide = calculateImageDimensions(
            doc,
            {
                type: MdTokenType.Image,
                data: PNG_1PX,
                naturalWidth: 2000,
                naturalHeight: 100,
            },
            100,
            1000,
            'mm',
        );
        expect(wide.finalWidth).toBe(100);
        expect(wide.finalHeight).toBeLessThan(100);

        const tall = calculateImageDimensions(
            doc,
            {
                type: MdTokenType.Image,
                data: PNG_1PX,
                naturalWidth: 100,
                naturalHeight: 2000,
            },
            1000,
            100,
            'mm',
        );
        expect(tall.finalHeight).toBe(100);
        expect(tall.finalWidth).toBeLessThan(1000);
    });

    it('warns and falls back when intrinsic size cannot be read', () => {
        const warnings = new RenderWarnings({ logToConsole: false });
        const brokenDoc = {
            getImageProperties: () => {
                throw new Error('UNKNOWN');
            },
        } as unknown as jsPDF;

        const { finalWidth, finalHeight } = calculateImageDimensions(
            brokenDoc,
            { type: MdTokenType.Image, data: PNG_1PX },
            1000,
            1000,
            'mm',
            warnings,
        );

        expect(warnings.list().map((w) => w.code)).toEqual([
            'IMAGE_SIZE_UNKNOWN',
        ]);
        // Aspect falls back to 1 and there is nothing to size from.
        expect(finalWidth).toBe(0);
        expect(finalHeight).toBe(0);
    });

    it('reads base64 SVG dimensions without a window object', () => {
        const { finalWidth, finalHeight } = calculateImageDimensions(
            doc,
            {
                type: MdTokenType.Image,
                data: svgDataUrl('<svg width="120" height="60"></svg>'),
            },
            1000,
            1000,
            'mm',
        );
        expect(finalWidth).toBeCloseTo((120 * 25.4) / 96, 10);
        expect(finalHeight).toBeCloseTo((60 * 25.4) / 96, 10);
    });

    it('falls back to the SVG viewBox when width/height are absent', () => {
        const { finalWidth, finalHeight } = calculateImageDimensions(
            doc,
            {
                type: MdTokenType.Image,
                data:
                    'data:image/svg+xml,' +
                    encodeURIComponent('<svg viewBox="0 0 200 100"></svg>'),
            },
            1000,
            1000,
            'px',
        );
        expect(finalWidth).toBe(200);
        expect(finalHeight).toBe(100);
    });

    it('decodes base64 SVGs through window.atob when present', () => {
        (globalThis as any).window = {
            atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
        };

        const { finalWidth, finalHeight } = calculateImageDimensions(
            doc,
            {
                type: MdTokenType.Image,
                data: svgDataUrl('<svg width="50" height="25"></svg>'),
            },
            1000,
            1000,
            'px',
        );
        expect(finalWidth).toBe(50);
        expect(finalHeight).toBe(25);
    });

    it('falls back to the global atob when Buffer is unavailable', () => {
        const data = svgDataUrl('<svg width="40" height="20"></svg>');
        hideBuffer();
        expect(typeof Buffer).toBe('undefined');
        expect(typeof atob).toBe('function');

        const { finalWidth, finalHeight } = calculateImageDimensions(
            doc,
            { type: MdTokenType.Image, data },
            1000,
            1000,
            'px',
        );
        expect(finalWidth).toBe(40);
        expect(finalHeight).toBe(20);
    });

    it('warns when an SVG data URI cannot be decoded', () => {
        const warnings = new RenderWarnings({ logToConsole: false });

        const { finalWidth, finalHeight } = calculateImageDimensions(
            doc,
            {
                type: MdTokenType.Image,
                // Truncated percent-encoding: decodeURIComponent throws.
                data: 'data:image/svg+xml,%E0%A4%A',
            },
            1000,
            1000,
            'mm',
            warnings,
        );

        expect(warnings.list().map((w) => w.code)).toEqual([
            'IMAGE_SIZE_UNKNOWN',
        ]);
        expect(finalWidth).toBe(0);
        expect(finalHeight).toBe(0);
    });
});

describe('blobToDataUrl FileReader fallback', () => {
    /** A Blob without arrayBuffer, so the FileReader branch is taken. */
    const legacyBlob = { type: 'image/jpeg' } as unknown as Blob;

    const installFileReader = (
        behavior: 'ok' | 'non-string' | 'error',
    ): void => {
        (globalThis as any).FileReader = class {
            result: string | ArrayBuffer | null = null;
            onloadend: (() => void) | null = null;
            onerror: ((error: unknown) => void) | null = null;
            readAsDataURL(): void {
                if (behavior === 'error') {
                    this.onerror?.(new Error('read failed'));
                    return;
                }
                this.result =
                    behavior === 'ok'
                        ? 'data:image/jpeg;base64,AAA'
                        : new ArrayBuffer(0);
                this.onloadend?.();
            }
        };
    };

    it('resolves through FileReader when arrayBuffer is missing', async () => {
        installFileReader('ok');
        await expect(blobToDataUrl(legacyBlob)).resolves.toBe(
            'data:image/jpeg;base64,AAA',
        );
    });

    it('rejects when FileReader produces a non-string result', async () => {
        installFileReader('non-string');
        await expect(blobToDataUrl(legacyBlob)).rejects.toThrow(
            /Failed to convert image to base64 string/,
        );
    });

    it('rejects when FileReader reports an error', async () => {
        installFileReader('error');
        await expect(blobToDataUrl(legacyBlob)).rejects.toThrow(/read failed/);
    });

    it('throws when the runtime has no way to read the blob', async () => {
        await expect(blobToDataUrl(legacyBlob)).rejects.toThrow(
            /No supported way to read image data/,
        );
    });
});

describe('bytesToBase64 runtime fallbacks', () => {
    it('encodes through btoa when Buffer is unavailable', async () => {
        hideBuffer();
        const blob = new Blob([new Uint8Array([1, 2, 3])], {
            type: 'image/png',
        });
        await expect(blobToDataUrl(blob)).resolves.toBe(
            'data:image/png;base64,AQID',
        );
    });

    it('throws when no base64 encoder exists at all', async () => {
        hideBuffer();
        const realBtoa = globalThis.btoa;
        (globalThis as any).btoa = undefined;
        try {
            const blob = new Blob([new Uint8Array([1])], {
                type: 'image/png',
            });
            await expect(blobToDataUrl(blob)).rejects.toThrow(
                /No base64 encoder available/,
            );
        } finally {
            globalThis.btoa = realBtoa;
        }
    });
});

describe('prefetchImages data: URL edge cases', () => {
    it('measures a URL-encoded (non-base64) data URL', async () => {
        const elements = [
            imageElement(
                'data:image/svg+xml,' +
                    encodeURIComponent('<svg width="10" height="5"></svg>'),
            ),
        ];

        await prefetchImages(elements, undefined);

        expect(elements[0].data).toBe(elements[0].src);
    });

    it('measures without TextEncoder via the Buffer path', async () => {
        hideTextEncoder();
        const elements = [
            imageElement(
                'data:image/svg+xml,' +
                    encodeURIComponent('<svg width="10" height="5"></svg>'),
            ),
        ];

        await prefetchImages(elements, undefined);

        expect(elements[0].data).toBe(elements[0].src);
    });

    it('measures with plain string length when no encoder exists', async () => {
        hideTextEncoder();
        hideBuffer();
        const elements = [
            imageElement(
                'data:image/svg+xml,' +
                    encodeURIComponent('<svg width="10" height="5"></svg>'),
            ),
        ];

        await prefetchImages(elements, undefined);

        expect(elements[0].data).toBe(elements[0].src);
    });

    it('treats an undecodable data URL as unmeasurable, not oversized', async () => {
        const elements = [imageElement('data:image/png,%E0%A4%A')];

        await prefetchImages(elements, undefined);

        // Size unknown (null) means the size limit is skipped.
        expect(elements[0].data).toBe(elements[0].src);
    });

    it('skips a data URL that exceeds maxImageSizeBytes', async () => {
        const elements = [imageElement(PNG_1PX)];
        const security = permissiveSecurity({ maxImageSizeBytes: 10 });

        await prefetchImages(elements, security);

        expect(elements[0].data).toBeUndefined();
        expect(elements[0].src).toBeUndefined();
    });
});

describe('prefetchImages SVG rasterisation (mocked browser)', () => {
    const installBrowser = (
        mode: 'load' | 'error',
        ctx: unknown,
    ): { width: number; height: number } => {
        const canvas = {
            width: 0,
            height: 0,
            getContext: () => ctx,
            toDataURL: () => 'data:image/png;base64,RASTER',
        };
        (globalThis as any).window = {
            atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
        };
        (globalThis as any).document = {
            createElement: () => canvas,
        };
        (globalThis as any).Image = class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            width = 0;
            height = 0;
            private _src = '';
            get src(): string {
                return this._src;
            }
            set src(value: string) {
                this._src = value;
                if (mode === 'load') {
                    this.onload?.();
                } else {
                    this.onerror?.();
                }
            }
        };
        return canvas;
    };

    it('rasterises an SVG to a high-res PNG and records natural size', async () => {
        const ctx = { scale: vi.fn(), drawImage: vi.fn() };
        const canvas = installBrowser('load', ctx);
        const elements = [
            imageElement(svgDataUrl('<svg width="120" height="60"></svg>')),
        ];

        await prefetchImages(elements, undefined);

        expect(elements[0].data).toBe('data:image/png;base64,RASTER');
        expect(elements[0].naturalWidth).toBe(120);
        expect(elements[0].naturalHeight).toBe(60);
        expect(canvas.width).toBe(480);
        expect(canvas.height).toBe(240);
        expect(ctx.scale).toHaveBeenCalledWith(4, 4);
        expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('keeps the SVG when the canvas has no 2d context', async () => {
        installBrowser('load', null);
        const src = svgDataUrl('<svg width="120" height="60"></svg>');
        const elements = [imageElement(src)];

        await prefetchImages(elements, undefined);

        expect(elements[0].data).toBe(src);
    });

    it('keeps the SVG when the image fails to load', async () => {
        installBrowser('error', { scale: vi.fn(), drawImage: vi.fn() });
        const src = svgDataUrl('<svg width="120" height="60"></svg>');
        const elements = [imageElement(src)];

        await prefetchImages(elements, undefined);

        expect(elements[0].data).toBe(src);
    });
});

describe('secureImageFetch error branches', () => {
    it('gives up after MAX_REDIRECT_HOPS redirects', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(null, {
                status: 302,
                headers: { location: '/next.png' },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);
        const security = permissiveSecurity({ imageFetchTimeoutMs: 0 });

        await expect(
            secureImageFetch('http://127.0.0.1:9/a.png', security),
        ).rejects.toThrow(/exceeded 5 redirects/);
        expect(fetchMock).toHaveBeenCalledTimes(6);
    });

    it('rejects an unparseable redirect target', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(null, {
                    status: 302,
                    headers: { location: 'http://[invalid' },
                }),
            ),
        );
        const security = permissiveSecurity({ imageFetchTimeoutMs: 0 });

        await expect(
            secureImageFetch('http://127.0.0.1:9/a.png', security),
        ).rejects.toThrow(/could not be parsed/);
    });

    it('rethrows a non-abort fetch failure', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('socket boom')),
        );
        const security = permissiveSecurity({ imageFetchTimeoutMs: 5000 });

        await expect(
            secureImageFetch('http://127.0.0.1:9/a.png', security),
        ).rejects.toThrow(/socket boom/);
    });

    it('returns the original response when it cannot be re-wrapped', async () => {
        const body = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('img'));
                controller.close();
            },
        });
        const raw = {
            ok: true,
            status: 200,
            // An invalid reason phrase makes `new Response(null, init)` throw,
            // so the deadline keeps governing the original body instead.
            statusText: 'not\r\nok',
            headers: new Headers(),
            body,
        };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(raw));
        const security = permissiveSecurity({ imageFetchTimeoutMs: 5000 });

        const response = await secureImageFetch(
            'http://127.0.0.1:9/a.png',
            security,
        );

        expect(response).toBe(raw);
    });
});

describe('readImageBlob without a streamable body', () => {
    const stubFetch = (blob: Blob): void => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'image/png' }),
                body: null,
                blob: async () => blob,
            }),
        );
    };

    it('reads the whole blob when no size limit applies', async () => {
        stubFetch(new Blob(['tiny'], { type: 'image/png' }));
        const elements = [imageElement('http://127.0.0.1:9/a.png')];
        const security = permissiveSecurity({ maxImageSizeBytes: 100 });

        await prefetchImages(elements, security);

        expect(elements[0].data).toBe('data:image/png;base64,dGlueQ==');
    });

    it('drops an over-limit blob with IMAGE_SIZE_EXCEEDED', async () => {
        stubFetch(new Blob(['way too many bytes'], { type: 'image/png' }));
        const elements = [imageElement('http://127.0.0.1:9/a.png')];
        const security = permissiveSecurity({ maxImageSizeBytes: 4 });

        await prefetchImages(elements, security);

        expect(elements[0].data).toBeUndefined();
        expect(elements[0].src).toBeUndefined();
    });

    it('warns and skips when the fetch response is not ok', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: new Headers(),
                body: null,
                cancel: async () => {},
            }),
        );
        const elements = [imageElement('http://127.0.0.1:9/missing.png')];
        const warnings = new RenderWarnings({ logToConsole: false });

        await prefetchImages(elements, undefined, warnings);

        expect(elements[0].data).toBeUndefined();
        expect(warnings.list().map((w) => w.code)).toEqual([
            'IMAGE_LOAD_FAILED',
        ]);
    });
});
