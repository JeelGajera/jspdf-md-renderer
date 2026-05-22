import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types/parsedElement';
import { RenderSecurityOptions } from '../types/security';
import { validateResourceUrl } from './security-policy';

/**
 * Applies link security rules to parsed markdown elements.
 * Rejected links are downgraded to plain text by clearing `href`.
 * In placeholder mode, blocked links render `security.placeholderText`.
 */
export const applyLinkPolicy = async (
    elements: ParsedElement[],
    security: RenderSecurityOptions,
): Promise<void> => {
    if (!security.enabled) return;

    const walk = async (nodes: ParsedElement[]) => {
        for (const node of nodes) {
            if (node.type === MdTokenType.Link && node.href) {
                if (security.disablePdfLinks) {
                    node.href = undefined;
                } else {
                    const isAllowed = await validateResourceUrl(
                        node.href,
                        'link',
                        security,
                        'markdown-link',
                    );
                    if (!isAllowed) {
                        node.href = undefined;
                        if (security.violationMode === 'placeholder') {
                            node.text = security.placeholderText || '[blocked]';
                            node.items = [
                                {
                                    type: MdTokenType.Text,
                                    content: node.text,
                                },
                            ];
                        }
                    }
                }
            }
            if (node.items?.length) await walk(node.items);
        }
    };

    await walk(elements);
};

/**
 * Replaces blocked image nodes with plain raw-text placeholders.
 * Used by `violationMode: 'placeholder'` to preserve layout continuity.
 */
export const convertBlockedImagesToPlaceholder = (
    elements: ParsedElement[],
    security: RenderSecurityOptions,
) => {
    const placeholder = security.placeholderImageText || '[blocked image]';
    const walk = (nodes: ParsedElement[]) => {
        for (const node of nodes) {
            if (node.type === MdTokenType.Image && !node.data) {
                node.type = MdTokenType.Raw;
                node.content = placeholder;
                node.src = undefined;
            }
            if (node.items?.length) walk(node.items);
        }
    };
    walk(elements);
};
