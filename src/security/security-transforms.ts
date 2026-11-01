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

    // Iterative pre-order walk: the old recursion overflowed on deeply
    // nested inline wrappers. Link handling runs before descending, exactly
    // as before (a placeholder replacement rewrites node.items first).
    const stack: Array<{ nodes: ParsedElement[]; index: number }> = [
        { nodes: elements, index: 0 },
    ];
    while (stack.length > 0) {
        const frame = stack[stack.length - 1];
        if (frame.index >= frame.nodes.length) {
            stack.pop();
            continue;
        }
        const node = frame.nodes[frame.index++];
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
        if (node.items?.length) {
            stack.push({ nodes: node.items, index: 0 });
        }
    }
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
    // Iterative pre-order walk (see applyLinkPolicy).
    const stack: Array<{ nodes: ParsedElement[]; index: number }> = [
        { nodes: elements, index: 0 },
    ];
    while (stack.length > 0) {
        const frame = stack[stack.length - 1];
        if (frame.index >= frame.nodes.length) {
            stack.pop();
            continue;
        }
        const node = frame.nodes[frame.index++];
        if (node.type === MdTokenType.Image && !node.data) {
            node.type = MdTokenType.Raw;
            node.content = placeholder;
            node.src = undefined;
        }
        if (node.items?.length) {
            stack.push({ nodes: node.items, index: 0 });
        }
    }
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
    // Iterative post-order walk (children before the node itself, as the old
    // recursion did): a visited flag replaces the call stack.
    const stack: Array<{ node: ParsedElement; visited: boolean }> = [];
    for (let i = elements.length - 1; i >= 0; i--) {
        stack.push({ node: elements[i], visited: false });
    }
    while (stack.length > 0) {
        const entry = stack.pop() as { node: ParsedElement; visited: boolean };
        const node = entry.node;
        if (!entry.visited) {
            stack.push({ node, visited: true });
            if (node.items?.length) {
                for (let i = node.items.length - 1; i >= 0; i--) {
                    stack.push({ node: node.items[i], visited: false });
                }
            }
            continue;
        }

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
