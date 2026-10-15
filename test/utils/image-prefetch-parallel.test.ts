import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { prefetchImages } from '../../src/utils/image-utils';
import { normalizeSecurityOptions } from '../../src/security/security-policy';
import { MdTokenType } from '../../src/enums/mdTokenType';
import { RenderWarnings } from '../../src/store/renderWarnings';
import type { ParsedElement } from '../../src/types/parsedElement';
import {
    SecurityViolationError,
    type RenderSecurityOptions,
    type SecurityViolation,
} from '../../src/types/security';

/**
 * Issue #89: remote images must load with bounded concurrency instead of one
 * after another, while warnings and violations still come out in document
 * order and `violationMode: 'throw'` throws the first violation in document
 * order.
 */

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

describe('parallel image prefetch', () => {
    it('loads remote images with overlapping, bounded concurrency', async () => {
        // Every response is delayed, so sequential loading would take
        // images * delay. Overlapping loads finish in about one delay.
        const DELAY_MS = 200;
        const IMAGE_COUNT = 10;
        let inFlight = 0;
        let peakInFlight = 0;
        const server: Server = createServer((req, res) => {
            inFlight += 1;
            peakInFlight = Math.max(peakInFlight, inFlight);
            setTimeout(() => {
                res.writeHead(200, { 'content-type': 'image/png' });
                res.end(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
                inFlight -= 1;
            }, DELAY_MS);
        });
        await new Promise<void>((resolve) =>
            server.listen(0, '127.0.0.1', resolve),
        );
        try {
            const port = (server.address() as AddressInfo).port;
            const nodes = Array.from({ length: IMAGE_COUNT }, (_, i) =>
                imageElement(`http://127.0.0.1:${port}/img${i}.png`),
            );

            const start = Date.now();
            await prefetchImages(nodes);
            const elapsed = Date.now() - start;

            // Sequential loading would need at least IMAGE_COUNT * DELAY_MS.
            expect(elapsed).toBeLessThan(IMAGE_COUNT * DELAY_MS);
            // The loads actually overlapped…
            expect(peakInFlight).toBeGreaterThan(1);
            // …but stayed bounded instead of firing all at once.
            expect(peakInFlight).toBeLessThanOrEqual(6);
            for (const node of nodes) {
                expect(node.data).toMatch(/^data:image\/png;base64,/);
            }
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    it('replays warnings in document order even when later images fail first', async () => {
        // Image `a` is slowest, so without document-order replay its warning
        // would come last.
        const delays: Record<string, number> = {
            'http://127.0.0.1:9/a.png': 60,
            'http://127.0.0.1:9/b.png': 30,
            'http://127.0.0.1:9/c.png': 0,
        };
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                await new Promise((r) => setTimeout(r, delays[url] ?? 0));
                throw new Error(`no such host: ${url}`);
            }),
        );
        const nodes = [
            imageElement('http://127.0.0.1:9/a.png'),
            imageElement('http://127.0.0.1:9/b.png'),
            imageElement('http://127.0.0.1:9/c.png'),
        ];
        const warnings = new RenderWarnings({ logToConsole: false });

        await prefetchImages(nodes, undefined, warnings);

        expect(warnings.list().map((w) => w.context)).toEqual([
            'http://127.0.0.1:9/a.png',
            'http://127.0.0.1:9/b.png',
            'http://127.0.0.1:9/c.png',
        ]);
    });

    it('reports violations in document order in skip mode', async () => {
        const seen: SecurityViolation[] = [];
        const security = permissiveSecurity({
            allowRemoteImages: false,
            onSecurityViolation: (v) => {
                seen.push(v);
            },
        });
        const nodes = [
            imageElement('https://example.com/a.png'),
            imageElement('https://example.com/b.png'),
            imageElement('https://example.com/c.png'),
        ];

        await prefetchImages(nodes, security);

        expect(seen.map((v) => v.value)).toEqual([
            'https://example.com/a.png',
            'https://example.com/b.png',
            'https://example.com/c.png',
        ]);
        expect(seen.every((v) => v.code === 'IMAGE_PROTOCOL_BLOCKED')).toBe(
            true,
        );
    });

    it("throws the first violation in document order in 'throw' mode", async () => {
        // The custom validator rejects every URL after a per-URL delay, so
        // the violations are *recorded* in reverse document order
        // (c, b, a). The thrown one must still be the first in document order.
        const delays: Record<string, number> = {
            'http://192.0.2.1/a.png': 60,
            'http://192.0.2.1/b.png': 30,
            'http://192.0.2.1/c.png': 0,
        };
        const seen: SecurityViolation[] = [];
        const security = permissiveSecurity({
            violationMode: 'throw',
            onSecurityViolation: (v) => {
                seen.push(v);
            },
            validateUrl: async (url: URL) => {
                await new Promise((r) =>
                    setTimeout(r, delays[url.toString()] ?? 0),
                );
                return false;
            },
        });
        const nodes = [
            imageElement('http://192.0.2.1/a.png'),
            imageElement('http://192.0.2.1/b.png'),
            imageElement('http://192.0.2.1/c.png'),
        ];

        const error = await prefetchImages(nodes, security).catch((e) => e);

        expect(error).toBeInstanceOf(SecurityViolationError);
        expect((error as SecurityViolationError).violation.code).toBe(
            'CUSTOM_VALIDATOR_BLOCKED',
        );
        expect((error as SecurityViolationError).violation.value).toBe(
            'http://192.0.2.1/a.png',
        );
        // Only the first document-order violation is ever reported.
        expect(seen.map((v) => v.value)).toEqual(['http://192.0.2.1/a.png']);
    });
});
