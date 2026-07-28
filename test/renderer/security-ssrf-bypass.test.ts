import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MdTextRender } from '../../src/renderer/MdTextRender';
import { createRenderOptions } from '../helpers/renderOptions';
import { MockDoc } from '../helpers/mockDoc';
import { prefetchImages } from '../../src/utils/image-utils';
import { createSecurity } from '../helpers/security';

describe('MdTextRender SSRF bypass regression (end-to-end)', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.reject(new Error('fetch should not be called for a blocked host')),
            ),
        );
    });
    afterEach(() => vi.unstubAllGlobals());

    /**
     * REAL ATTACK PATH — full Markdown → marked.lexer → security → prefetch pipeline.
     *
     * The exploit uses angle-bracket URL syntax in Markdown to prevent marked from
     * stripping backslashes. `marked` then preserves the backslash characters in
     * the href token value.
     *
     *   Markdown text:   ![t](<\\evil.example.com/tracker.png>)
     *   marked href:     \\evil.example.com/tracker.png  (double backslash preserved)
     *
     * BEFORE the fix:
     *   classifyUrl("\\evil.example.com/...") → 'relativePath'
     *   (backslash prefix matched neither "//" nor an explicit scheme)
     *   → all domain/SSRF checks bypassed → fetch() called with the raw value
     *
     * AFTER the fix:
     *   normalizeUrlForClassification replaces every \ with / first:
     *   "\\evil.example.com/..." → "//evil.example.com/..." → 'protocolRelative'
     *   → domain check: evil.example.com ∉ allowedImageDomains → blocked
     *   → fetch() never called
     *
     * JS string escaping note (4 backslashes in JS source = 2 in string value):
     *   '\\\\evil.example.com' in JS source = \\evil.example.com in the string
     *   Inside the angle-bracket Markdown url <\\evil.example.com>, marked preserves
     *   the two backslashes verbatim in the href token.
     */
    it('blocks a double-backslash obfuscated image host through the full markdown render path', async () => {
        const doc = new MockDoc();
        // Markdown angle-bracket syntax preserves backslashes in the href token.
        // This string has 8 backslash chars in JS source = 4 literal backslashes at
        // runtime = the markdown text contains <\\\\evil.example.com/...>.
        // marked parses that and emits href: "\\evil.example.com/..." (2 backslashes).
        // normalizeUrlForClassification maps each \ → /, giving "//evil.example.com/..."
        // which is classified protocolRelative and blocked by allowedImageDomains.
        const md = '![tracker](<\\\\\\\\evil.example.com/tracker.png>)';
        await MdTextRender(
            doc as never,
            md,
            createRenderOptions({
                security: {
                    enabled: true,
                    allowedImageDomains: ['good.example.com'],
                    blockPrivateIPs: true,
                    blockMetadataIPs: true,
                    violationMode: 'skip',
                },
            }),
        );
        expect(fetch).not.toHaveBeenCalled();
    });

    it('blocks a slash-backslash obfuscated image host through the full markdown render path', async () => {
        const doc = new MockDoc();
        // Markdown angle-bracket form </\evil.example.com/...>:
        // marked emits href: "/\evil.example.com/..." (slash + single backslash)
        // normalizeUrlForClassification: / stays, \ → / → "//evil.example.com/..." → protocolRelative → blocked
        const md = '![tracker](</\\evil.example.com/tracker.png>)';
        await MdTextRender(
            doc as never,
            md,
            createRenderOptions({
                security: {
                    enabled: true,
                    allowedImageDomains: ['good.example.com'],
                    blockPrivateIPs: true,
                    blockMetadataIPs: true,
                    violationMode: 'skip',
                },
            }),
        );
        expect(fetch).not.toHaveBeenCalled();
    });

    /**
     * Direct API path — covers callers that construct ParsedElement trees
     * programmatically (bypassing MdTextParser) with raw href values that the
     * pre-fix code would have misclassified as safe relative paths.
     */
    it('blocks backslash-obfuscated hrefs when called via prefetchImages directly', async () => {
        const security = createSecurity({
            allowedImageDomains: ['good.example.com'],
            blockPrivateIPs: true,
            blockMetadataIPs: true,
            violationMode: 'skip',
        });
        const nodes = [
            { type: 'image', src: '\\\\evil.example.com/steal.png' },  // \\evil.com
            { type: 'image', src: '/\\evil.example.com/steal.png' },   // /\evil.com
        ];
        await prefetchImages(nodes as never, security);

        expect(nodes[0].src).toBeUndefined();
        expect(nodes[1].src).toBeUndefined();
        expect(fetch).not.toHaveBeenCalled();
    });
});
