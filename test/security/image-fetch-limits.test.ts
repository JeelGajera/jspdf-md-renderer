import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/renderer/MdTextRender';
import { RenderSecurityOptions } from '../../src/types/security';

const PNG_BYTES = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
);
const MB = 1024 * 1024;

const servers: http.Server[] = [];
afterEach(async () => {
    for (const server of servers.splice(0)) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    }
});

const serve = async (handler: http.RequestListener): Promise<string> => {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', () => resolve()),
    );
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/a.png`;
};

/** Security that lets the probe server through while enforcing the limits. */
const security = (
    overrides: RenderSecurityOptions = {},
): RenderSecurityOptions => ({
    enabled: true,
    blockLocalhost: false,
    ...overrides,
});

const render = (url: string, overrides: RenderSecurityOptions = {}) =>
    MdTextRender(new jsPDF(), `![x](${url})`, {
        font: { regular: { name: 'helvetica', style: 'normal' } },
        silent: true,
        security: security(overrides),
    });

/** Streams `total` bytes in 64 KB chunks, honouring backpressure. */
const streamBytes = (
    res: http.ServerResponse,
    total: number,
    counter: { sent: number },
) => {
    const chunk = Buffer.alloc(64 * 1024, 1);
    const pump = () => {
        while (counter.sent < total) {
            counter.sent += chunk.length;
            if (!res.write(chunk)) {
                res.once('drain', pump);
                return;
            }
        }
        res.end();
    };
    res.on('close', () => res.removeAllListeners('drain'));
    pump();
};

describe('imageFetchTimeoutMs covers the response body', () => {
    it('gives up on a body that never finishes', async () => {
        const url = await serve((_req, res) => {
            res.writeHead(200, { 'content-type': 'image/png' });
            res.write('x');
            const drip = setInterval(() => res.write('x'), 50);
            res.on('close', () => clearInterval(drip));
        });

        const started = Date.now();
        const result = await render(url, { imageFetchTimeoutMs: 300 });

        expect(Date.now() - started).toBeLessThan(3000);
        const failure = result.warnings.find(
            (w) => w.code === 'IMAGE_LOAD_FAILED',
        );
        expect(failure?.message).toMatch(/timed out after 300ms/);
    });

    it('still loads an image that arrives within the deadline', async () => {
        const url = await serve((_req, res) => {
            res.writeHead(200, { 'content-type': 'image/png' });
            res.end(PNG_BYTES);
        });

        const result = await render(url, { imageFetchTimeoutMs: 2000 });

        expect(result.warnings).toEqual([]);
        expect(result.violations).toEqual([]);
    });
});

describe('maxImageSizeBytes is enforced before the body is buffered', () => {
    it('stops reading an undeclared body at the limit', async () => {
        const counter = { sent: 0 };
        const url = await serve((_req, res) => {
            res.writeHead(200, { 'content-type': 'image/png' });
            streamBytes(res, 64 * MB, counter);
        });

        const result = await render(url, { maxImageSizeBytes: MB });

        const violation = result.violations.find(
            (v) => v.code === 'IMAGE_SIZE_EXCEEDED',
        );
        expect(violation?.context).toBe('blob-size');
        expect(Number(violation?.value)).toBeGreaterThan(MB);
        // 4.3.0 read all 64 MB before rejecting. Socket buffers let the server
        // write somewhat past the point the client stopped reading.
        expect(counter.sent).toBeLessThan(16 * MB);
    });

    it('rejects a declared Content-Length over the limit without reading it', async () => {
        const counter = { sent: 0 };
        const url = await serve((_req, res) => {
            res.writeHead(200, {
                'content-type': 'image/png',
                'content-length': String(64 * MB),
            });
            streamBytes(res, 64 * MB, counter);
        });

        const result = await render(url, { maxImageSizeBytes: MB });

        const violation = result.violations.find(
            (v) => v.code === 'IMAGE_SIZE_EXCEEDED',
        );
        expect(violation?.context).toBe('content-length');
        expect(violation?.value).toBe(String(64 * MB));
        expect(counter.sent).toBeLessThan(16 * MB);
    });

    it('accepts an image exactly at the limit', async () => {
        const url = await serve((_req, res) => {
            res.writeHead(200, { 'content-type': 'image/png' });
            res.end(PNG_BYTES);
        });

        const result = await render(url, {
            maxImageSizeBytes: PNG_BYTES.length,
        });

        expect(result.violations).toEqual([]);
        expect(result.warnings).toEqual([]);
    });
});
