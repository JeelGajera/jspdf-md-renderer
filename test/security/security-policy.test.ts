import { describe, expect, it, vi } from 'vitest';
import {
    handleSecurityViolation,
    normalizeSecurityOptions,
    validateResourceUrl,
} from '../../src/security/security-policy';
import { SecurityViolationError } from '../../src/types/security';
import { createSecurity } from '../helpers/security';

describe('security-policy', () => {
    it('treats protocol-relative image URL as external and validates domain', async () => {
        const security = createSecurity({
            allowedImageDomains: ['cdn.example.com'],
        });

        const allowed = await validateResourceUrl(
            '//attacker.example.com/image.png',
            'image',
            security,
        );

        expect(allowed).toBe(false);
    });

    it('blocks protocol-relative localhost URLs when localhost blocking is enabled', async () => {
        const security = createSecurity({ blockLocalhost: true });
        const allowed = await validateResourceUrl(
            '//localhost/internal',
            'image',
            security,
        );
        expect(allowed).toBe(false);
    });

    it('allows relative paths by default', async () => {
        const security = createSecurity();
        await expect(
            validateResourceUrl('/docs/page', 'link', security),
        ).resolves.toBe(true);
        await expect(
            validateResourceUrl('./asset.png', 'image', security),
        ).resolves.toBe(true);
    });

    it('lets custom validator reject relative paths', async () => {
        const security = createSecurity({
            validateUrl: () => false,
        });
        const allowed = await validateResourceUrl('/blocked', 'link', security);
        expect(allowed).toBe(false);
    });

    it('treats undefined image domain list as allow-all and empty array as deny-all', async () => {
        const allowAll = normalizeSecurityOptions({
            enabled: true,
            allowedImageDomains: undefined,
        });
        const denyAll = normalizeSecurityOptions({
            enabled: true,
            allowedImageDomains: [],
        });

        await expect(
            validateResourceUrl('https://example.invalid/a.png', 'image', allowAll),
        ).resolves.toBe(true);
        await expect(
            validateResourceUrl('https://example.com/a.png', 'image', denyAll),
        ).resolves.toBe(false);
    });

    it('returns placeholder action for placeholder mode', () => {
        const security = createSecurity({ violationMode: 'placeholder' });
        const action = handleSecurityViolation(security, {
            code: 'INVALID_URL',
            type: 'link',
            message: 'blocked',
            value: 'javascript:alert(1)',
        });
        expect(action).toBe('placeholder');
    });

    it('throws SecurityViolationError in throw mode', () => {
        const security = createSecurity({ violationMode: 'throw' });

        expect(() =>
            handleSecurityViolation(security, {
                code: 'INVALID_URL',
                type: 'link',
                message: 'blocked',
                value: 'javascript:alert(1)',
            }),
        ).toThrow(SecurityViolationError);
    });

    it('does not crash when onSecurityViolation callback throws', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const security = createSecurity({
            onSecurityViolation: () => {
                throw new Error('hook failure');
            },
        });

        const action = handleSecurityViolation(security, {
            code: 'INVALID_URL',
            type: 'link',
            message: 'blocked',
        });

        expect(action).toBe('skip');
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
