import { describe, expect, it, vi } from 'vitest';
import {
    parseImageAttrsFromHref,
    preprocessImageAttributes,
} from '../../src/parser/imageExtension';

describe('imageExtension parser hardening', () => {
    it('parses valid width/height/align attributes', () => {
        const input = '![alt](https://img.test/a.png){width=200 height=150 align=center}';
        const processed = preprocessImageAttributes(input);
        const href = processed.match(/\(([^)]+)\)/)?.[1] ?? '';
        const parsed = parseImageAttrsFromHref(href);

        expect(parsed.cleanHref).toBe('https://img.test/a.png');
        expect(parsed.attrs.width).toBe(200);
        expect(parsed.attrs.height).toBe(150);
        expect(parsed.attrs.align).toBe('center');
    });

    it('skips oversized attribute blocks without hanging', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const longAttrs = `width=200 ${'k='.repeat(400)}`;
        const input = `![alt](https://img.test/a.png){${longAttrs}}`;

        const started = Date.now();
        const processed = preprocessImageAttributes(input);
        const elapsed = Date.now() - started;

        expect(elapsed).toBeLessThan(100);
        expect(processed).toContain('https://img.test/a.png');
        expect(processed).not.toContain('__jmr_');
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
