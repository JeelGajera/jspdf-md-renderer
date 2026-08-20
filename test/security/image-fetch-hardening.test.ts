import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    blobToDataUrl,
    prefetchImages,
    secureImageFetch,
} from '../../src/utils/image-utils';
import { normalizeSecurityOptions } from '../../src/security/security-policy';
import { MdTokenType } from '../../src/enums/mdTokenType';
import type { ParsedElement } from '../../src/types/parsedElement';

/**
 * D3 — remote images never loaded in Node because FileReader is not a Node
 * global. The ReferenceError was swallowed and the image silently skipped.
 * D4 — fetch followed redirects transparently, so an allowed host could
 * bounce the request to an internal service with no re-validation.
 */

let internal: http.Server;
let redirector: http.Server;
let internalPort = 0;
let redirectorPort = 0;

const PNG_BYTES = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
);

beforeAll(async () => {
    internal = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(PNG_BYTES);
    });
    await new Promise<void>((r) => internal.listen(0, '127.0.0.1', () => r()));
    internalPort = (internal.address() as AddressInfo).port;

    redirector = http.createServer((_req, res) => {
        res.writeHead(302, {
            Location: `http://127.0.0.1:${internalPort}/internal.png`,
        });
        res.end();
    });
    await new Promise<void>((r) =>
        redirector.listen(0, '127.0.0.1', () => r()),
    );
    redirectorPort = (redirector.address() as AddressInfo).port;
});

afterAll(async () => {
    await new Promise<void>((r) => internal.close(() => r()));
    await new Promise<void>((r) => redirector.close(() => r()));
});

describe('blobToDataUrl (D3)', () => {
    it('encodes a blob without relying on FileReader', async () => {
        // Node has no FileReader; this must still work.
        expect(typeof FileReader).toBe('undefined');

        const blob = new Blob([PNG_BYTES], { type: 'image/png' });
        const dataUrl = await blobToDataUrl(blob);

        expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
        const payload = dataUrl.split(',')[1];
        expect(Buffer.from(payload, 'base64').equals(PNG_BYTES)).toBe(true);
    });

    it('populates element.data for a remote image in Node', async () => {
        const elements: ParsedElement[] = [
            {
                type: MdTokenType.Image,
                src: `http://127.0.0.1:${internalPort}/x.png`,
            },
        ];

        await prefetchImages(elements, undefined);

        expect(elements[0].data).toBeDefined();
        expect(elements[0].data?.startsWith('data:image/png;base64,')).toBe(
            true,
        );
    });
});

describe('secureImageFetch redirects (D4)', () => {
    it('blocks a redirect into a private address when security is enabled', async () => {
        const security = normalizeSecurityOptions({
            enabled: true,
            blockLocalhost: true,
            blockPrivateIPs: true,
            violationMode: 'skip',
        });

        // The redirector itself is on loopback, so allow the first hop through
        // a custom validator that only permits the redirector's own port. The
        // redirect target must still be rejected.
        const permissive = {
            ...security,
            blockLocalhost: false,
            validateUrl: (url: URL) =>
                url.port === String(redirectorPort),
        };

        await expect(
            secureImageFetch(
                `http://127.0.0.1:${redirectorPort}/pic.png`,
                permissive,
            ),
        ).rejects.toThrow(/redirect hop 1/);
    });

    it('still follows a redirect that passes validation', async () => {
        const security = normalizeSecurityOptions({
            enabled: true,
            blockLocalhost: false,
            blockPrivateIPs: false,
            blockLinkLocalIPs: false,
            blockMetadataIPs: false,
            violationMode: 'skip',
        });

        const response = await secureImageFetch(
            `http://127.0.0.1:${redirectorPort}/pic.png`,
            security,
        );

        expect(response.ok).toBe(true);
        const bytes = Buffer.from(await response.arrayBuffer());
        expect(bytes.equals(PNG_BYTES)).toBe(true);
    });

    it('leaves redirect handling to fetch when security is disabled', async () => {
        const response = await secureImageFetch(
            `http://127.0.0.1:${redirectorPort}/pic.png`,
            undefined,
        );
        expect(response.ok).toBe(true);
        expect(response.redirected).toBe(true);
    });
});

describe('image fetch timeout (D4)', () => {
    it('aborts a request that exceeds imageFetchTimeoutMs', async () => {
        const stalled = http.createServer(() => {
            // Never respond.
        });
        await new Promise<void>((r) => stalled.listen(0, '127.0.0.1', () => r()));
        const port = (stalled.address() as AddressInfo).port;

        const security = normalizeSecurityOptions({
            enabled: true,
            blockLocalhost: false,
            blockPrivateIPs: false,
            imageFetchTimeoutMs: 150,
            violationMode: 'skip',
        });

        await expect(
            secureImageFetch(`http://127.0.0.1:${port}/slow.png`, security),
        ).rejects.toThrow(/timed out after 150ms/);

        await new Promise<void>((r) => stalled.close(() => r()));
    });

    it('defaults to a bounded timeout rather than waiting forever', () => {
        const security = normalizeSecurityOptions({ enabled: true });
        expect(security.imageFetchTimeoutMs).toBe(10_000);
    });
});

describe('prefetch resilience', () => {
    it('warns and skips when an image cannot be fetched', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const elements: ParsedElement[] = [
            {
                type: MdTokenType.Image,
                src: 'http://127.0.0.1:1/nope.png',
                alt: 'missing',
            },
        ];

        await prefetchImages(elements, undefined);

        expect(elements[0].data).toBeUndefined();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
