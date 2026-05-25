import { describe, expect, it, vi } from 'vitest';
import { MdTokenType } from '../../src/enums/mdTokenType';
import { prefetchImages } from '../../src/utils/image-utils';
import { createSecurity } from '../helpers/security';
import { SecurityViolationError } from '../../src/types/security';
import { ParsedElement } from '../../src/types/parsedElement';

const SVG_DATA =
    "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1'%20height='1'%3E%3C/svg%3E";

describe('image prefetch security', () => {
    it('blocks svg data urls when allowSvgImages is false', async () => {
        const security = createSecurity({
            allowDataUrls: true,
            allowSvgImages: false,
        });
        const nodes: ParsedElement[] = [{ type: MdTokenType.Image, src: SVG_DATA }];

        await prefetchImages(nodes, security);

        expect(nodes[0].src).toBeUndefined();
        expect(nodes[0].data).toBeUndefined();
    });

    it('blocks data urls when allowDataUrls is false', async () => {
        const security = createSecurity({
            allowDataUrls: false,
            allowSvgImages: true,
        });
        const nodes: ParsedElement[] = [
            { type: MdTokenType.Image, src: 'data:image/png;base64,AQID' },
        ];

        await prefetchImages(nodes, security);
        expect(nodes[0].src).toBeUndefined();
    });

    it('keeps data url when data and svg are both allowed', async () => {
        const security = createSecurity({
            allowDataUrls: true,
            allowSvgImages: true,
        });
        const nodes: ParsedElement[] = [{ type: MdTokenType.Image, src: SVG_DATA }];

        await prefetchImages(nodes, security);
        expect(nodes[0].data).toBe(SVG_DATA);
    });

    it('enforces decoded byte limits for base64 data urls', async () => {
        const security = createSecurity({
            maxImageSizeBytes: 3,
        });
        const nodes: ParsedElement[] = [
            { type: MdTokenType.Image, src: 'data:image/png;base64,AQIDBA==' },
        ];

        await prefetchImages(nodes, security);
        expect(nodes[0].src).toBeUndefined();
    });

    it('enforces decoded byte limits for non-base64 data urls', async () => {
        const security = createSecurity({
            maxImageSizeBytes: 2,
        });
        const nodes: ParsedElement[] = [
            { type: MdTokenType.Image, src: 'data:text/plain,%E2%82%AC' },
        ];

        await prefetchImages(nodes, security);
        expect(nodes[0].src).toBeUndefined();
    });

    it('applies security checks recursively for nested image nodes', async () => {
        const security = createSecurity({
            allowRemoteImages: false,
            violationMode: 'skip',
        });
        const nodes: ParsedElement[] = [
            {
                type: MdTokenType.List,
                items: [
                    {
                        type: MdTokenType.ListItem,
                        items: [
                            {
                                type: MdTokenType.Image,
                                src: 'https://cdn.example.com/nested.png',
                            },
                        ],
                    },
                ],
            },
        ];

        await prefetchImages(nodes, security);
        const nestedImage = nodes[0].items?.[0].items?.[0];
        expect(nestedImage?.src).toBeUndefined();
        expect(nestedImage?.data).toBeUndefined();
    });

    it('preserves throw-mode behavior for image violations', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const security = createSecurity({
            allowRemoteImages: false,
            violationMode: 'throw',
        });
        const nodes: ParsedElement[] = [
            { type: MdTokenType.Image, src: 'https://bad.example.com/x.png' },
        ];

        await expect(prefetchImages(nodes, security)).rejects.toBeInstanceOf(
            SecurityViolationError,
        );
        expect(warnSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('Failed to load image'),
        );
        warnSpy.mockRestore();
    });
});
