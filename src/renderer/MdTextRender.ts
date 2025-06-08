import jsPDF from 'jspdf';
import { MdTokenType } from '../enums/mdTokenType';
import { MdTextParser } from '../parser/MdTextParser';
import { ParsedElement } from '../types/parsedElement';
import { RenderOption } from '../types/renderOption';
import { HandlePageBreaks } from '../utils/handlePageBreak';
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
} from './components';
import { getCharHight } from '../utils/doc-helpers';
import { RenderStore } from '../store/renderStore';

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
    RenderStore.initialize(options);
    const parsedElements = await MdTextParser(text);
    console.log(parsedElements);

    const renderElement = (
        element: ParsedElement,
        indentLevel: number = 0,
        hasRawBullet: boolean = false,
        start: number = 0,
        ordered: boolean = false,
        justify: boolean = true,
    ) => {
        const indent = indentLevel * options.page.indent;
        if (
            RenderStore.Y +
                doc.splitTextToSize(
                    element.content ?? '',
                    options.page.maxContentWidth - indent,
                ).length *
                    getCharHight(doc) >=
            options.page.maxContentHeight
        ) {
            HandlePageBreaks(doc);
        }

        switch (element.type) {
            case MdTokenType.Heading:
                renderHeading(doc, element, indent, renderElement);
                break;
            case MdTokenType.Paragraph:
                renderParagraph(doc, element, indent, renderElement);
                break;
            case MdTokenType.List:
                renderList(doc, element, indentLevel, renderElement);
                break;
            case MdTokenType.ListItem:
                renderListItem(
                    doc,
                    element,
                    indentLevel,
                    renderElement,
                    start,
                    ordered,
                );
                break;
            case MdTokenType.Hr:
                renderHR(doc);
                break;
            case MdTokenType.Code:
                renderCodeBlock(doc, element, indentLevel, hasRawBullet);
                break;
            case MdTokenType.Strong:
            case MdTokenType.Em:
                renderInlineText(doc, element, indent);
                break;
            case MdTokenType.Link:
                renderLink(doc, element, indent);
                break;
            case MdTokenType.Raw:
            case MdTokenType.Text:
                renderRawItem(
                    doc,
                    element,
                    indentLevel,
                    hasRawBullet,
                    renderElement,
                    start,
                    ordered,
                    justify,
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
        renderElement(item);
    }

    options.endCursorYHandler(RenderStore.Y);
};
