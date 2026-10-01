import dns from 'node:dns';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { MdTextRender } from '../../src/renderer/MdTextRender';
import { validateResourceUrl } from '../../src/security/security-policy';
import { createSecurity } from '../helpers/security';

describe('link validation does not resolve hostnames', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    const spyOnLookup = () =>
        vi
            .spyOn(dns.promises, 'lookup')
            .mockResolvedValue([
                { address: '93.184.216.34', family: 4 },
            ] as never);

    it('renders links without any DNS lookups', async () => {
        const lookup = spyOnLookup();
        const markdown = Array.from(
            { length: 5 },
            (_, i) => `[link ${i}](https://host${i}.example.org/)`,
        ).join(' ');

        const result = await MdTextRender(new jsPDF(), markdown, {
            font: { regular: { name: 'helvetica', style: 'normal' } },
            silent: true,
            security: { enabled: true },
        });

        expect(lookup).not.toHaveBeenCalled();
        expect(result.violations).toEqual([]);
    });

    it('still blocks a link to a literal loopback or private address', async () => {
        const security = createSecurity();

        expect(
            await validateResourceUrl('http://127.0.0.2/', 'link', security),
        ).toBe(false);
        expect(
            await validateResourceUrl('http://[::ffff:10.0.0.1]/', 'link', security),
        ).toBe(false);
    });

    it.each([
        ['http://localhost./admin', 'LOCALHOST_BLOCKED'],
        ['http://app.localhost/admin', 'LOCALHOST_BLOCKED'],
        ['http://metadata.google.internal./', 'METADATA_IP_BLOCKED'],
    ])(
        'blocks the local hostname spelling %s without resolving it',
        async (url, code) => {
            const lookup = spyOnLookup();
            const codes: string[] = [];
            const security = createSecurity({
                onSecurityViolation: (v) => codes.push(v.code),
            });

            expect(await validateResourceUrl(url, 'link', security)).toBe(
                false,
            );
            expect(codes).toEqual([code]);
            expect(lookup).not.toHaveBeenCalled();
        },
    );

    it('still resolves image hosts', async () => {
        const lookup = spyOnLookup();
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.reject(new Error('offline'))),
        );

        await MdTextRender(
            new jsPDF(),
            '![x](https://images.example.org/a.png)',
            {
                font: { regular: { name: 'helvetica', style: 'normal' } },
                silent: true,
                security: { enabled: true },
            },
        );

        expect(lookup).toHaveBeenCalledWith('images.example.org', {
            all: true,
        });
    });
});
