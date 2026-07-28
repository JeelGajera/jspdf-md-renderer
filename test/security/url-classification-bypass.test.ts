import { describe, it, expect } from 'vitest';
import { validateResourceUrl } from '../../src/security/security-policy';
import { RenderSecurityOptions } from '../../src/types/security';

describe('URL classification bypass (backslash host obfuscation)', () => {
    const security: RenderSecurityOptions = {
        enabled: true,
        allowedImageDomains: ['good.example.com'],
        allowedLinkProtocols: ['https:', 'http:', 'mailto:', 'tel:'],
        blockLocalhost: true,
        blockPrivateIPs: true,
        blockLinkLocalIPs: true,
        blockMetadataIPs: true,
        violationMode: 'skip',
    };

    // --- Exploit regression tests: these MUST return false ---

    it('rejects a backslash-backslash obfuscated image host', async () => {
        const allowed = await validateResourceUrl('\\\\evil.example.com/steal.png', 'image', security);
        expect(allowed).toBe(false);
    });

    it('rejects a slash-backslash obfuscated image host', async () => {
        const allowed = await validateResourceUrl('/\\evil.example.com/steal.png', 'image', security);
        expect(allowed).toBe(false);
    });

    it('rejects a backslash-obfuscated cloud metadata IP', async () => {
        const allowed = await validateResourceUrl('\\\\169.254.169.254/latest/meta-data/', 'image', security);
        expect(allowed).toBe(false);
    });

    it('rejects a backslash-obfuscated host for links, not just images', async () => {
        // Use an obfuscated localhost address — this should be blocked because
        // after normalization \\127.0.0.1/steal → //127.0.0.1/steal → external absolute,
        // and 127.0.0.1 is blocked by blockLocalhost.
        const allowed = await validateResourceUrl('\\\\127.0.0.1/steal', 'link', security);
        expect(allowed).toBe(false);
    });

    it('rejects a tab-obfuscated javascript: scheme in links (defense in depth)', async () => {
        const allowed = await validateResourceUrl('java\tscript:alert(1)', 'link', security);
        expect(allowed).toBe(false);
    });

    // --- Regression tests: legitimate behavior MUST be unchanged ---

    it('still allows legitimate relative paths', async () => {
        for (const relative of ['/dashboard', './file.png', '?q=1', '#section']) {
            expect(await validateResourceUrl(relative, 'link', security)).toBe(true);
        }
    });

    it('still allows a protocol-relative URL on an allowed image domain', async () => {
        const allowed = await validateResourceUrl('//good.example.com/img.png', 'image', security);
        expect(allowed).toBe(true);
    });

    it('still blocks a protocol-relative URL on a disallowed image domain', async () => {
        const allowed = await validateResourceUrl('//evil.example.com/img.png', 'image', security);
        expect(allowed).toBe(false);
    });

    it('still allows a normal https link with an allowed protocol', async () => {
        const allowed = await validateResourceUrl('https://good.example.com/page', 'link', security);
        expect(allowed).toBe(true);
    });

    it('still blocks a disallowed protocol on links (e.g. ftp:)', async () => {
        const allowed = await validateResourceUrl('ftp://good.example.com/file', 'link', security);
        expect(allowed).toBe(false);
    });
});
