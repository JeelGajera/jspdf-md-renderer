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

/**
 * Replaces images that have no data with their alt text.
 *
 * An image whose fetch failed kept its `image` type with no `data`, and the
 * renderer returned early, so the image and its alt text both vanished from
 * the page with only a console warning. Falling back to the alt text matches
 * what browsers do and keeps the author's meaning in the document.
 *
 * Runs after the security placeholder pass so blocked images keep their
 * configured placeholder text.
 */
export const convertUnloadableImagesToAltText = (
    elements: ParsedElement[],
): void => {
    const walk = (nodes: ParsedElement[]) => {
        for (const node of nodes) {
            if (node.items?.length) walk(node.items);

            if (node.type !== MdTokenType.Image || node.data) continue;

            const alt = node.alt?.trim();
            if (alt) {
                node.type = MdTokenType.Text;
                node.content = alt;
                node.src = undefined;
            } else {
                // Nothing meaningful to show in its place. Convert rather than
                // remove: emptying a paragraph's items list makes the renderer
                // fall back to the paragraph's raw markdown source, which would
                // print the image syntax into the document.
                node.type = MdTokenType.Noop;
                node.content = '';
                node.src = undefined;
            }
        }
    };
    walk(elements);
};
