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
    const parsedElements = await MdTextParser(text);
    console.log(parsedElements);
    RenderStore.initialize(options);

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
                    getCharHight(doc, options) >=
            options.page.maxContentHeight
        ) {
            HandlePageBreaks(doc, options);
            RenderStore.updateY(options.page.topmargin)
        }

        switch (element.type) {
            case MdTokenType.Heading:
                renderHeading(
                    doc,
                    element,
                    indent,
                    options,
                    renderElement,
                );
                break;
            case MdTokenType.Paragraph:
                renderParagraph(
                    doc,
                    element,
                    indent,
                    options,
                    renderElement,
                );
                break;
            case MdTokenType.List:
                renderList(
                    doc,
                    element,
                    indentLevel,
                    options,
                    renderElement,
                );
                break;
            case MdTokenType.ListItem:
                renderListItem(
                    doc,
                    element,
                    indentLevel,
                    options,
                    renderElement,
                    start,
                    ordered,
                );
                break;
            case MdTokenType.Hr:
                renderHR(doc, options);
                break;
            case MdTokenType.Code:
                renderCodeBlock(
                    doc,
                    element,
                    indentLevel,
                    hasRawBullet,
                    options,
                );
                break;
            case MdTokenType.Strong:
            case MdTokenType.Em:
                renderInlineText(
                    doc,
                    element,
                    indent,
                    options,
                );
                break;
            case MdTokenType.Raw:
            case MdTokenType.Text:
                renderRawItem(
                    doc,
                    element,
                    indentLevel,
                    hasRawBullet,
                    options,
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
                    with details of the element and expected behavior. Thank you for helping to improve this library!`,
                );
                break;
        }
    };

    for (const item of parsedElements) {
        renderElement(item);
    }

    options.endCursorYHandler(RenderStore.Y);
};
