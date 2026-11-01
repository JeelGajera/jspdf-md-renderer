import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types/parsedElement';
import { RenderSecurityOptions } from '../types/security';
import { RenderWarnings } from '../store/renderWarnings';
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
    warnings?: RenderWarnings,
): void => {
    if (!security.enabled) return;

    let imageCount = 0;
    const maxDepth = security.maxNestedDepth || 0;
    const maxImageCount = security.maxImageCount || 0;
    const placeholderText = security.placeholderImageText || '[blocked image]';
    let imageLimitViolated = false;
    let depthLimitViolated = false;
    let droppedNodeCount = 0;

    // Iterative version of the old recursive sanitizeNodes: an explicit
    // frame stack replaces the per-`items` recursion, so deeply nested
    // inline wrappers (which do not count towards maxNestedDepth and are
    // therefore not dropped) cannot overflow the call stack. Node order,
    // depth accounting, violation reporting and placeholder handling are
    // unchanged.
    interface SanitizeFrame {
        nodes: ParsedElement[];
        index: number;
        depth: number;
        out: ParsedElement[];
        owner: ParsedElement | null;
    }
    const sanitizeNodesIterative = (
        rootNodes: ParsedElement[],
    ): ParsedElement[] => {
        let rootOut: ParsedElement[] = [];
        const stack: SanitizeFrame[] = [
            { nodes: rootNodes, index: 0, depth: 1, out: [], owner: null },
        ];
        while (stack.length > 0) {
            const frame = stack[stack.length - 1];
            if (frame.index >= frame.nodes.length) {
                stack.pop();
                if (frame.owner) {
                    frame.owner.items = frame.out;
                    // The owner frame is suspended below, so pushing here
                    // preserves document order exactly.
                    stack[stack.length - 1].out.push(frame.owner);
                } else {
                    rootOut = frame.out;
                }
                continue;
            }
            const node = frame.nodes[frame.index++];
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
                        frame.out.push({
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
                    ? frame.depth + 1
                    : frame.depth;
                if (maxDepth > 0 && nextDepth > maxDepth) {
                    droppedNodeCount += countNodes(node.items);
                    // Report once per render rather than once per branch, but
                    // never stay silent: dropping a subtree under the default
                    // 'skip' mode used to remove content with no signal to
                    // the caller at all.
                    if (!depthLimitViolated) {
                        depthLimitViolated = true;
                        handleSecurityViolation(security, {
                            code: 'MAX_NESTED_DEPTH_EXCEEDED',
                            type: 'markdown',
                            message:
                                'Markdown nesting depth exceeds configured limit; ' +
                                'the nested content was dropped',
                            value: String(nextDepth),
                        });
                    }
                    node.items = [];
                    frame.out.push(node);
                    continue;
                }
                stack.push({
                    nodes: node.items,
                    index: 0,
                    depth: nextDepth,
                    out: [],
                    owner: node,
                });
                continue;
            }

            frame.out.push(node);
        }
        return rootOut;
    };

    const sanitizedRoot = sanitizeNodesIterative(elements);
    elements.length = 0;
    elements.push(...sanitizedRoot);

    if (droppedNodeCount > 0) {
        warnings?.warn({
            code: 'CONTENT_DROPPED',
            message:
                `${droppedNodeCount} node(s) were dropped because the markdown ` +
                `nested deeper than security.maxNestedDepth (${maxDepth}). ` +
                'Raise the limit or flatten the document to keep this content.',
            context: 'maxNestedDepth',
            droppedNodes: droppedNodeCount,
        });
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
const countNodes = (nodes: ParsedElement[]): number => {
    let total = 0;
    const stack: ParsedElement[][] = [nodes];
    while (stack.length > 0) {
        const list = stack.pop() as ParsedElement[];
        for (const node of list) {
            total++;
            if (node.items?.length) stack.push(node.items);
        }
    }
    return total;
};

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
