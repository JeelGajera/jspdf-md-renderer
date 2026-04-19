import jsPDF from 'jspdf';
import { MdTokenType } from '../enums/mdTokenType';
import { MdTextParser } from '../parser/MdTextParser';
import { ParsedElement } from '../types/parsedElement';
import { RenderOption } from '../types/renderOption';
import {
    renderHeading,
    renderHR,
    renderList,
    renderListItem,
    renderParagraph,
    renderRawItem,
    renderCodeBlock,
    renderInlineText,
    renderLink,
    renderBlockquote,
    renderImage,
    renderTable,
} from './components';
import { RenderStore } from '../store/renderStore';
import { prefetchImages } from '../utils/image-utils';
import { validateOptions } from '../utils/options-validation';
import { getCharHight } from '../utils/doc-helpers';
import { HandlePageBreaks } from '../utils/handlePageBreak';

/**
 * Renders parsed markdown text into jsPDF document.
 *
 * @param doc - The jsPDF document.
 * @param text - The markdown content to render.
 * @param options - The render options (fonts, page margins, etc.).
 */
export const MdTextRender = async (
    doc: jsPDF,
    text: string,
    options: RenderOption,
) => {
    const validOptions = validateOptions(options);
    const store = new RenderStore(validOptions);
    const parsedElements = await MdTextParser(text);
    await prefetchImages(parsedElements);
    // console.log(parsedElements);

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
                renderHeading(doc, element, indent, store, renderElement);
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
            case MdTokenType.Strong:
            case MdTokenType.Em:
            case MdTokenType.CodeSpan:
                renderInlineText(doc, element, indent, store);
                break;
            case MdTokenType.Link:
                renderLink(doc, element, indent, store);
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
                console.warn(
                    `Warning: Unsupported element type encountered: ${element.type}. 
                    If you believe this element type should be supported, please create an issue at:
                    https://github.com/JeelGajera/jspdf-md-renderer/issues
                    with details of the element and expected behavior. Thanks for helping to improve this library!`,
                );
                break;
        }
    };

    for (const item of parsedElements) {
        renderElement(item, 0, store);
    }

    validOptions.endCursorYHandler(store.Y);
};
