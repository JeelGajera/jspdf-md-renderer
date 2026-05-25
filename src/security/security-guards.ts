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

    const sanitizeNodes = (
        nodes: ParsedElement[],
        depth: number,
    ): ParsedElement[] => {
        if (maxDepth > 0 && depth > maxDepth) {
            handleSecurityViolation(security, {
                code: 'MAX_NESTED_DEPTH_EXCEEDED',
                type: 'markdown',
                message: 'Markdown nesting depth exceeds configured limit',
                value: String(depth),
            });
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
                node.items = sanitizeNodes(node.items, depth + 1);
            }

            sanitized.push(node);
        }

        return sanitized;
    };

    const sanitizedRoot = sanitizeNodes(elements, 1);
    elements.length = 0;
    elements.push(...sanitizedRoot);
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
