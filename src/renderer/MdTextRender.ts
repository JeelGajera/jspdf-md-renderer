import jsPDF from 'jspdf';
import { MdTokenType } from '../enums/mdTokenType';
import { MdTextParser } from '../parser/MdTextParser';
import { ParsedElement } from '../types/parsedElement';
import { RenderOption, RenderResult } from '../types/renderOption';
import { RenderWarnings } from '../store/renderWarnings';
import { SecurityViolation } from '../types/security';
import {
    renderHeading,
    renderHR,
    renderList,
    renderListItem,
    renderParagraph,
    renderRawItem,
    renderCodeBlock,
    renderBlockquote,
    renderImage,
    renderTable,
} from './components';
import { renderInlineContent } from '../layout';
import { RenderStore } from '../store/renderStore';
import { prefetchImages } from '../utils/image-utils';
import { validateOptions } from '../utils/options-validation';
import { getCharHight } from '../utils/doc-helpers';
import {
    HandlePageBreaks,
    markPageContentStart,
} from '../utils/handlePageBreak';
import { applyPageDecorations } from '../utils/pageDecorations';
import {
    createTimeoutGuard,
    enforceMarkdownLimits,
    enforceNestedDepthAndImageCount,
} from '../security/security-guards';
import {
    applyLinkPolicy,
    convertBlockedImagesToPlaceholder,
    convertUnloadableImagesToAltText,
} from '../security/security-transforms';

/**
 * Renders markdown into a jsPDF document.
 *
 * @param doc - The jsPDF document.
 * @param text - The markdown content to render.
 * @param options - The render options (fonts, page margins, etc.).
 * @returns A summary of the render, including anything that could not be drawn.
 */
export const MdTextRender = async (
    doc: jsPDF,
    text: string,
    options: RenderOption,
): Promise<RenderResult> => {
    const validOptions = validateOptions(options, doc);
    const security = validOptions.security || {};
    const guardTimeout = createTimeoutGuard(security);

    const violations: SecurityViolation[] = [];
    // `security` is the merged copy `normalizeSecurityOptions` produced, never
    // the caller's own object, so wrapping the handler here cannot leak back
    // into options the caller intends to reuse across renders.
    const callerViolationHandler = security.onSecurityViolation;
    security.onSecurityViolation = (violation) => {
        violations.push(violation);
        callerViolationHandler?.(violation);
    };

    const warnings = new RenderWarnings({
        listener: validOptions.onWarning,
        logToConsole: !validOptions.silent,
    });

    enforceMarkdownLimits(text, security);
    guardTimeout();

    const store = new RenderStore(validOptions, warnings);
    markPageContentStart(doc, store);
    // Rendering twice into the same document used to stamp the header and
    // footer onto every page again, doubling them on the pages the earlier
    // call had already decorated.
    const firstPage =
        (
            doc as unknown as {
                internal: { getCurrentPageInfo: () => { pageNumber: number } };
            }
        ).internal?.getCurrentPageInfo?.()?.pageNumber ?? 1;
    const parsedElements = await MdTextParser(text, warnings);
    guardTimeout();

    enforceNestedDepthAndImageCount(parsedElements, security, warnings);
    await applyLinkPolicy(parsedElements, security);
    await prefetchImages(parsedElements, security, warnings);
    guardTimeout();

    if (security.enabled && security.violationMode === 'placeholder') {
        convertBlockedImagesToPlaceholder(parsedElements, security);
    }

    // Any image still without data could not be loaded. Fall back to its alt
    // text rather than dropping the content silently.
    convertUnloadableImagesToAltText(parsedElements);

    const renderElement = (
        element: ParsedElement,
        indentLevel: number = 0,
        store: RenderStore,
        hasRawBullet: boolean = false,
        start: number = 0,
        ordered: boolean = false,
    ) => {
        const indent = indentLevel * validOptions.page.indent;

        switch (element.type) {
            case MdTokenType.Heading:
                renderHeading(doc, element, indent, store);
                break;
            case MdTokenType.Paragraph:
                renderParagraph(doc, element, indent, store, renderElement);
                break;
            case MdTokenType.List:
                renderList(doc, element, indentLevel, store, renderElement);
                break;
            case MdTokenType.ListItem:
                renderListItem(
                    doc,
                    element,
                    indentLevel,
                    store,
                    renderElement,
                    start,
                    ordered,
                );
                break;
            case MdTokenType.Hr:
                renderHR(doc, store);
                break;
            case MdTokenType.Code:
                renderCodeBlock(doc, element, indentLevel, store);
                break;
            // Renders nothing by design (e.g. link reference definitions).
            case MdTokenType.Noop:
                break;
            case MdTokenType.Space:
                // Historically these blank-line tokens fell through to the raw
                // renderer and added a line of space on top of the configured
                // spacing.* values, so the spacing options never fully
                // determined the gap between blocks. 'collapse' opts out.
                if (validOptions.spacing?.blankLines === 'collapse') break;
                renderRawItem(
                    doc,
                    { type: MdTokenType.Raw, content: element.content },
                    indentLevel,
                    store,
                    hasRawBullet,
                    renderElement,
                    start,
                    ordered,
                    validOptions.content?.textAlignment === 'justify',
                );
                break;
            case MdTokenType.Strong:
            case MdTokenType.Em:
            case MdTokenType.Del:
            case MdTokenType.CodeSpan:
            case MdTokenType.Link:
                renderInlineContent(
                    doc,
                    [element],
                    store.X + indent,
                    store.Y,
                    validOptions.page.maxContentWidth - indent,
                    store,
                );
                break;
            case MdTokenType.Blockquote:
                renderBlockquote(
                    doc,
                    element,
                    indentLevel,
                    store,
                    renderElement,
                );
                break;
            case MdTokenType.Image:
                renderImage(doc, element, indentLevel, store);
                break;
            case MdTokenType.Br: {
                store.updateX(validOptions.page.xpading, 'set');
                const brHeight =
                    getCharHight(doc) *
                    validOptions.page.defaultLineHeightFactor;

                // Check if the break pushes us off the page
                if (store.Y + brHeight > validOptions.page.maxContentHeight) {
                    HandlePageBreaks(doc, store);
                } else {
                    store.updateY(brHeight, 'add');
                }
                store.recordContentY();
                break;
            }
            case MdTokenType.Table:
                renderTable(doc, element, indentLevel, store);
                break;
            case MdTokenType.Raw:
            case MdTokenType.Text:
                renderRawItem(
                    doc,
                    element,
                    indentLevel,
                    store,
                    hasRawBullet,
                    renderElement,
                    start,
                    ordered,
                    validOptions.content?.textAlignment === 'justify',
                );
                break;
            default:
                // The element is not drawn, so this is content loss.
                store.warn({
                    code: 'UNSUPPORTED_ELEMENT',
                    message:
                        `Unsupported element type '${element.type}' was skipped. ` +
                        'If it should be supported, please open an issue at ' +
                        'https://github.com/JeelGajera/jspdf-md-renderer/issues',
                    context: element.type,
                    droppedNodes: 1,
                });
                break;
        }
    };

    for (const item of parsedElements) {
        guardTimeout();
        renderElement(item, 0, store);
    }

    applyPageDecorations(doc, validOptions, firstPage);
    validOptions.endCursorYHandler(store.Y);

    const lastPage =
        (
            doc as unknown as {
                internal: { getNumberOfPages: () => number };
            }
        ).internal?.getNumberOfPages?.() ?? firstPage;

    return {
        endY: store.Y,
        startPage: firstPage,
        pageCount: Math.max(0, lastPage - firstPage + 1),
        warnings: warnings.list(),
        droppedNodes: warnings.droppedNodes,
        violations,
    };
};
