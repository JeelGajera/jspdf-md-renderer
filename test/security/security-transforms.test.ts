import { describe, expect, it } from 'vitest';
import { MdTokenType } from '../../src/enums/mdTokenType';
import {
    applyLinkPolicy,
    convertBlockedImagesToPlaceholder,
} from '../../src/security/security-transforms';
import { createSecurity } from '../helpers/security';
import { ParsedElement } from '../../src/types/parsedElement';

describe('security transforms', () => {
    it('returns early when security is disabled', async () => {
        const security = createSecurity({
            enabled: false,
        });
        const nodes: ParsedElement[] = [
            { type: MdTokenType.Link, href: 'javascript:alert(1)' },
        ];

        await applyLinkPolicy(nodes, security);
        expect(nodes[0].href).toBe('javascript:alert(1)');
    });

    it('can disable all PDF link actions while preserving text', async () => {
        const security = createSecurity({
            disablePdfLinks: true,
        });
        const nodes: ParsedElement[] = [
            { type: MdTokenType.Link, href: 'https://example.com', text: 'A' },
        ];

        await applyLinkPolicy(nodes, security);
        expect(nodes[0].href).toBeUndefined();
        expect(nodes[0].text).toBe('A');
    });

    it('renders blocked links as placeholder text in placeholder mode', async () => {
        const security = createSecurity({
            violationMode: 'placeholder',
            placeholderText: '[link blocked]',
            allowedLinkProtocols: ['https:'],
        });
        const nodes: ParsedElement[] = [
            {
                type: MdTokenType.Link,
                href: 'javascript:alert(1)',
                text: 'Click',
                items: [{ type: MdTokenType.Text, content: 'Click' }],
            },
        ];

        await applyLinkPolicy(nodes, security);

        expect(nodes[0].href).toBeUndefined();
        expect(nodes[0].text).toBe('[link blocked]');
        expect(nodes[0].items?.[0].content).toBe('[link blocked]');
    });

    it('keeps valid links and recursively processes nested links', async () => {
        const security = createSecurity({
            allowedLinkProtocols: ['https:'],
        });
        const nodes: ParsedElement[] = [
            {
                type: MdTokenType.Paragraph,
                items: [
                    {
                        type: MdTokenType.Link,
                        href: 'https://example.com',
                        text: 'OK',
                    },
                    {
                        type: MdTokenType.Link,
                        href: 'javascript:alert(1)',
                        text: 'NO',
                    },
                ],
            },
        ];

        await applyLinkPolicy(nodes, security);
        expect(nodes[0].items?.[0].href).toBe('https://example.com');
        expect(nodes[0].items?.[1].href).toBeUndefined();
    });

    it('converts blocked images to placeholders in placeholder mode', () => {
        const security = createSecurity({
            violationMode: 'placeholder',
            placeholderImageText: '[blocked image]',
        });
        const nodes: ParsedElement[] = [
            { type: MdTokenType.Image, src: undefined, data: undefined },
        ];

        convertBlockedImagesToPlaceholder(nodes, security);
        expect(nodes[0].type).toBe(MdTokenType.Raw);
        expect(nodes[0].content).toBe('[blocked image]');
    });

    it('leaves non-blocked and nested images intact', () => {
        const security = createSecurity({
            violationMode: 'placeholder',
            placeholderImageText: '[blocked image]',
        });
        const nodes: ParsedElement[] = [
            {
                type: MdTokenType.Paragraph,
                items: [
                    { type: MdTokenType.Image, data: 'data:image/png;base64,AAA=' },
                ],
            },
        ];

        convertBlockedImagesToPlaceholder(nodes, security);
        expect(nodes[0].items?.[0].type).toBe(MdTokenType.Image);
    });
});
