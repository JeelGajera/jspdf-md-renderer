import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types/parsedElement';
import { RenderSecurityOptions } from '../types/security';
import { handleSecurityViolation } from './security-policy';

/**
 * Enforces input-size limits before tokenization/rendering starts.
 * Violations are delegated to the configured violation handler.
 */
export const enforceMarkdownLimits = (
    text: string,
    security: RenderSecurityOptions,
): void => {
    if (!security.enabled) return;
    if (
        (security.maxMarkdownLength || 0) > 0 &&
        text.length > (security.maxMarkdownLength || 0)
    ) {
        const action = handleSecurityViolation(security, {
            code: 'MARKDOWN_TOO_LARGE',
            type: 'markdown',
            message: 'Markdown length exceeds configured limit',
            value: String(text.length),
        });
        if (action === 'skip' || action === 'placeholder') {
            throw new Error(
                `[jspdf-md-renderer] Markdown input rejected: length ${text.length} exceeds maxMarkdownLength ${security.maxMarkdownLength}.`,
            );
        }
    }
};

/**
 * Walks the parsed markdown tree and enforces structural limits:
 * nesting depth and image count.
 */
export const enforceNestedDepthAndImageCount = (
    elements: ParsedElement[],
    security: RenderSecurityOptions,
): void => {
    if (!security.enabled) return;

    let imageCount = 0;
    const maxDepth = security.maxNestedDepth || 0;
    const maxImageCount = security.maxImageCount || 0;
    const placeholderText = security.placeholderImageText || '[blocked image]';
    let imageLimitViolated = false;
    let depthLimitViolated = false;
    let droppedNodeCount = 0;

    const sanitizeNodes = (
        nodes: ParsedElement[],
        depth: number,
    ): ParsedElement[] => {
        if (maxDepth > 0 && depth > maxDepth) {
            droppedNodeCount += countNodes(nodes);
            // Report once per render rather than once per branch, but never
            // stay silent: dropping a subtree under the default 'skip' mode
            // used to remove content with no signal to the caller at all.
            if (!depthLimitViolated) {
                depthLimitViolated = true;
                handleSecurityViolation(security, {
                    code: 'MAX_NESTED_DEPTH_EXCEEDED',
                    type: 'markdown',
                    message:
                        'Markdown nesting depth exceeds configured limit; ' +
                        'the nested content was dropped',
                    value: String(depth),
                });
            }
            return [];
        }

        const sanitized: ParsedElement[] = [];
        for (const node of nodes) {
            if (node.type === MdTokenType.Image) {
                imageCount++;
                const exceedsLimit =
                    maxImageCount > 0 && imageCount > maxImageCount;
                if (exceedsLimit) {
                    if (!imageLimitViolated) {
                        imageLimitViolated = true;
                        handleSecurityViolation(security, {
                            code: 'MAX_IMAGE_COUNT_EXCEEDED',
                            type: 'image',
                            message: 'Image count exceeds configured limit',
                            value: String(imageCount),
                        });
                    }

                    if (security.violationMode === 'placeholder') {
                        sanitized.push({
                            type: MdTokenType.Raw,
                            content: placeholderText,
                        });
                    }
                    continue;
                }
            }

            if (node.items?.length) {
                // Only structural containers count towards the limit. Counting
                // every AST level made the option mean something very different
                // from its documentation: inline wrappers nest several levels
                // deep on their own, so a plain 10-level markdown list reached
                // AST depth 22 and tripped a limit documented as 20 "markdown
                // nesting" levels — the real ceiling was about 9.
                const nextDepth = STRUCTURAL_TYPES.has(node.type)
                    ? depth + 1
                    : depth;
                node.items = sanitizeNodes(node.items, nextDepth);
            }

            sanitized.push(node);
        }

        return sanitized;
    };

    const sanitizedRoot = sanitizeNodes(elements, 1);
    elements.length = 0;
    elements.push(...sanitizedRoot);

    if (droppedNodeCount > 0) {
        console.warn(
            `[jspdf-md-renderer] ${droppedNodeCount} node(s) were dropped because the ` +
                `markdown nested deeper than security.maxNestedDepth (${maxDepth}). ` +
                'Raise the limit or flatten the document to keep this content.',
        );
    }
};

/**
 * Container types that represent real markdown nesting. `maxNestedDepth` counts
 * only these, so the option means what its name and documentation say.
 */
const STRUCTURAL_TYPES: ReadonlySet<string> = new Set<string>([
    MdTokenType.List,
    MdTokenType.ListItem,
    MdTokenType.Blockquote,
    MdTokenType.Table,
]);

/** Total nodes in a subtree, for reporting how much was dropped. */
const countNodes = (nodes: ParsedElement[]): number =>
    nodes.reduce((total, node) => total + 1 + countNodes(node.items ?? []), 0);

/**
 * Creates a lightweight timeout guard function for long render flows.
 * Call the returned function at checkpoints (parse, prefetch, render loop).
 */
export const createTimeoutGuard = (security: RenderSecurityOptions) => {
    const timeoutAt =
        security.enabled && (security.renderTimeoutMs || 0) > 0
            ? Date.now() + (security.renderTimeoutMs || 0)
            : 0;

    return () => {
        if (timeoutAt > 0 && Date.now() > timeoutAt) {
            const action = handleSecurityViolation(security, {
                code: 'RENDER_TIMEOUT_EXCEEDED',
                type: 'render',
                message: 'Render time exceeded configured timeout',
                value: String(security.renderTimeoutMs),
            });
            if (action === 'skip' || action === 'placeholder') {
                throw new Error(
                    `[jspdf-md-renderer] Render aborted: exceeded renderTimeoutMs (${security.renderTimeoutMs}ms).`,
                );
            }
        }
    };
};
