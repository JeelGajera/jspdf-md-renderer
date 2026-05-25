import { describe, expect, it, vi } from 'vitest';
import { MdTokenType } from '../../src/enums/mdTokenType';
import {
    createTimeoutGuard,
    enforceMarkdownLimits,
    enforceNestedDepthAndImageCount,
} from '../../src/security/security-guards';
import { SecurityViolationError } from '../../src/types/security';
import { ParsedElement } from '../../src/types/parsedElement';
import { createSecurity } from '../helpers/security';

describe('security-guards', () => {
    it('does nothing when security is disabled', () => {
        const security = createSecurity({ enabled: false, maxMarkdownLength: 1 });
        const elements: ParsedElement[] = [
            { type: MdTokenType.Image, src: 'https://a.com/1.png' },
            { type: MdTokenType.Image, src: 'https://a.com/2.png' },
        ];

        expect(() => enforceMarkdownLimits('abcdef', security)).not.toThrow();
        enforceNestedDepthAndImageCount(elements, security);
        expect(elements).toHaveLength(2);
    });

    it('allows markdown within limit', () => {
        const security = createSecurity({ maxMarkdownLength: 10 });
        expect(() => enforceMarkdownLimits('short', security)).not.toThrow();
    });

    it('throws typed violation error for oversized markdown in throw mode', () => {
        const security = createSecurity({
            violationMode: 'throw',
            maxMarkdownLength: 3,
        });
        expect(() => enforceMarkdownLimits('abcdef', security)).toThrow(
            SecurityViolationError,
        );
    });

    it('aborts render in skip mode for oversized markdown', () => {
        const security = createSecurity({
            violationMode: 'skip',
            maxMarkdownLength: 3,
        });
        expect(() => enforceMarkdownLimits('abcdef', security)).toThrow(
            /Markdown input rejected/,
        );
    });

    it('prunes nodes beyond max nested depth', () => {
        const security = createSecurity({
            maxNestedDepth: 2,
            violationMode: 'skip',
        });
        const elements: ParsedElement[] = [
            {
                type: MdTokenType.List,
                items: [
                    {
                        type: MdTokenType.ListItem,
                        items: [
                            {
                                type: MdTokenType.List,
                                items: [
                                    { type: MdTokenType.Text, content: 'too deep' },
                                ],
                            },
                        ],
                    },
                ],
            },
        ];

        enforceNestedDepthAndImageCount(elements, security);

        const secondLevelItems = elements[0].items?.[0].items;
        expect(secondLevelItems).toEqual([]);
    });

    it('replaces overflow images with placeholder when in placeholder mode', () => {
        const violations: string[] = [];
        const security = createSecurity({
            maxImageCount: 1,
            violationMode: 'placeholder',
            placeholderImageText: '[img blocked]',
            onSecurityViolation: (violation) => violations.push(violation.code),
        });
        const elements: ParsedElement[] = [
            { type: MdTokenType.Image, src: 'https://a.com/1.png' },
            { type: MdTokenType.Image, src: 'https://a.com/2.png' },
            { type: MdTokenType.Image, src: 'https://a.com/3.png' },
        ];

        enforceNestedDepthAndImageCount(elements, security);

        expect(elements).toHaveLength(3);
        expect(elements[1].type).toBe(MdTokenType.Raw);
        expect(elements[1].content).toBe('[img blocked]');
        expect(elements[2].type).toBe(MdTokenType.Raw);
        expect(violations.filter((v) => v === 'MAX_IMAGE_COUNT_EXCEEDED')).toHaveLength(
            1,
        );
    });

    it('drops overflow images when in skip mode', () => {
        const security = createSecurity({
            maxImageCount: 1,
            violationMode: 'skip',
        });
        const elements: ParsedElement[] = [
            { type: MdTokenType.Image, src: 'https://a.com/1.png' },
            { type: MdTokenType.Image, src: 'https://a.com/2.png' },
            { type: MdTokenType.Text, content: 'keep me' },
        ];

        enforceNestedDepthAndImageCount(elements, security);

        expect(elements).toHaveLength(2);
        expect(elements[0].type).toBe(MdTokenType.Image);
        expect(elements[1].type).toBe(MdTokenType.Text);
    });

    it('aborts on timeout in skip mode', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

        const security = createSecurity({
            renderTimeoutMs: 50,
            violationMode: 'skip',
        });
        const guard = createTimeoutGuard(security);
        vi.setSystemTime(new Date('2026-01-01T00:00:00.100Z'));

        expect(() => guard()).toThrow(/Render aborted: exceeded renderTimeoutMs/);
        vi.useRealTimers();
    });

    it('throws SecurityViolationError on timeout in throw mode', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

        const security = createSecurity({
            renderTimeoutMs: 10,
            violationMode: 'throw',
        });
        const guard = createTimeoutGuard(security);
        vi.setSystemTime(new Date('2026-01-01T00:00:00.050Z'));

        expect(() => guard()).toThrow(SecurityViolationError);
        vi.useRealTimers();
    });

    it('does not throw before timeout window', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

        const security = createSecurity({
            renderTimeoutMs: 1000,
            violationMode: 'skip',
        });
        const guard = createTimeoutGuard(security);
        vi.setSystemTime(new Date('2026-01-01T00:00:00.500Z'));

        expect(() => guard()).not.toThrow();
        vi.useRealTimers();
    });
});
