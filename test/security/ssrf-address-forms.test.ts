import http from 'node:http';
import { AddressInfo } from 'node:net';
import dns from 'node:dns';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/renderer/MdTextRender';
import { validateResourceUrl } from '../../src/security/security-policy';
import {
    RenderSecurityOptions,
    SecurityViolation,
} from '../../src/types/security';
import { createSecurity } from '../helpers/security';

/** Validates `url` as an image and returns the violation code, or 'allowed'. */
const check = async (
    url: string,
    overrides: RenderSecurityOptions = {},
): Promise<string> => {
    const violations: SecurityViolation[] = [];
    const security = createSecurity({
        ...overrides,
        onSecurityViolation: (v) => violations.push(v),
    });
    const allowed = await validateResourceUrl(url, 'image', security);
    return allowed ? 'allowed' : (violations[0]?.code ?? 'blocked');
};

describe('SSRF checks cover every spelling of a blocked address', () => {
    afterEach(() => vi.restoreAllMocks());

    it.each([
        // The rest of 127.0.0.0/8 — only 127.0.0.1 itself used to be caught.
        ['http://127.0.0.2/', 'LOCALHOST_BLOCKED'],
        ['http://127.255.255.254/', 'LOCALHOST_BLOCKED'],
        // 0.0.0.0 reaches services listening only on 127.0.0.1.
        ['http://0.0.0.0/', 'LOCALHOST_BLOCKED'],
        ['http://0/', 'LOCALHOST_BLOCKED'],
        ['http://[::]/', 'LOCALHOST_BLOCKED'],
        // IPv6 forms that carry an IPv4 address are held to the IPv4 rules.
        ['http://[::ffff:127.0.0.1]/', 'LOCALHOST_BLOCKED'],
        ['http://[::ffff:7f00:2]/', 'LOCALHOST_BLOCKED'],
        ['http://[::127.0.0.1]/', 'LOCALHOST_BLOCKED'],
        ['http://[::ffff:0.0.0.0]/', 'LOCALHOST_BLOCKED'],
        ['http://[64:ff9b::7f00:1]/', 'LOCALHOST_BLOCKED'],
        ['http://[2002:7f00:1::]/', 'LOCALHOST_BLOCKED'],
        ['http://[::ffff:10.0.0.1]/', 'PRIVATE_IP_BLOCKED'],
        ['http://[64:ff9b::a9fe:a9fe]/', 'LINK_LOCAL_IP_BLOCKED'],
        // Unchanged behaviour.
        ['http://127.0.0.1/', 'LOCALHOST_BLOCKED'],
        ['http://[::1]/', 'LOCALHOST_BLOCKED'],
        ['http://10.1.2.3/', 'PRIVATE_IP_BLOCKED'],
        ['http://172.16.0.1/', 'PRIVATE_IP_BLOCKED'],
        ['http://192.168.1.1/', 'PRIVATE_IP_BLOCKED'],
        ['http://[fc00::1]/', 'PRIVATE_IP_BLOCKED'],
        ['http://169.254.169.254/', 'LINK_LOCAL_IP_BLOCKED'],
        ['http://[fe80::1]/', 'LINK_LOCAL_IP_BLOCKED'],
    ])('blocks %s', async (url, code) => {
        expect(await check(url)).toBe(code);
    });

    it.each([
        'http://93.184.216.34/',
        'http://[2606:4700:4700::1111]/',
        'http://[::ffff:8.8.8.8]/',
        'http://172.32.0.1/',
        'http://128.0.0.1/',
    ])('allows the public address %s', async (url) => {
        expect(await check(url)).toBe('allowed');
    });

    it('classifies the AWS IPv6 metadata address as metadata', async () => {
        expect(
            await check('http://[fd00:ec2::254]/', { blockPrivateIPs: false }),
        ).toBe('METADATA_IP_BLOCKED');
    });

    it('still reports metadata once link-local blocking is off', async () => {
        expect(
            await check('http://169.254.169.254/', {
                blockLinkLocalIPs: false,
            }),
        ).toBe('METADATA_IP_BLOCKED');
    });

    it('honours each option being switched off', async () => {
        expect(
            await check('http://127.0.0.2/', { blockLocalhost: false }),
        ).toBe('allowed');
        expect(
            await check('http://[::ffff:10.0.0.1]/', {
                blockPrivateIPs: false,
            }),
        ).toBe('allowed');
    });

    it('blocks a hostname that resolves to an alternative loopback address', async () => {
        vi.spyOn(dns.promises, 'lookup').mockResolvedValue([
            { address: '127.0.0.2', family: 4 },
        ] as never);

        expect(await check('http://internal.example.test/a.png')).toBe(
            'LOCALHOST_BLOCKED',
        );
    });
});

describe('SSRF checks against a real local service', () => {
    const servers: http.Server[] = [];
    afterEach(async () => {
        await Promise.all(
            servers.splice(0).map(
                (server) => new Promise((resolve) => server.close(resolve)),
            ),
        );
    });

    const listen = async (host: string) => {
        const hits: string[] = [];
        const server = http.createServer((req, res) => {
            hits.push(req.url ?? '');
            res.writeHead(200, { 'content-type': 'image/png' });
            res.end();
        });
        servers.push(server);
        await new Promise<void>((resolve) =>
            server.listen(0, host, () => resolve()),
        );
        return { hits, port: (server.address() as AddressInfo).port };
    };

    const render = (url: string) =>
        MdTextRender(new jsPDF(), `![x](${url})`, {
            font: { regular: { name: 'helvetica', style: 'normal' } },
            silent: true,
            security: { enabled: true },
        });

    it('does not reach a localhost-only service through 0.0.0.0', async () => {
        const { hits, port } = await listen('127.0.0.1');

        const result = await render(`http://0.0.0.0:${port}/admin`);

        expect(hits).toEqual([]);
        expect(result.violations.map((v) => v.code)).toContain(
            'LOCALHOST_BLOCKED',
        );
    });

    it('does not reach a local service through 127.0.0.2', async () => {
        const { hits, port } = await listen('0.0.0.0');

        const result = await render(`http://127.0.0.2:${port}/admin`);

        expect(hits).toEqual([]);
        expect(result.violations.map((v) => v.code)).toContain(
            'LOCALHOST_BLOCKED',
        );
    });
});
