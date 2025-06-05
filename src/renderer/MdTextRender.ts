import jsPDF from 'jspdf';
import { MdTokenType } from '../enums/mdTokenType';
import { MdTextParser } from '../parser/MdTextParser';
import { ParsedElement } from '../types/parsedElement';
import { Cursor, RenderOption } from '../types/renderOption';
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
    // console.log(parsedElements);
    let cursor: Cursor = {
        x: options.cursor.x,
        y: options.cursor.y,
    };

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
            cursor.y +
                doc.splitTextToSize(
                    element.content ?? '',
                    options.page.maxContentWidth - indent,
                ).length *
                    getCharHight(doc, options) >=
            options.page.maxContentHeight
        ) {
            HandlePageBreaks(doc, options);
            cursor.y = options.page.topmargin;
        }

        switch (element.type) {
            case MdTokenType.Heading:
                cursor = renderHeading(
                    doc,
                    element,
                    cursor,
                    indent,
                    options,
                    renderElement,
                );
                break;
            case MdTokenType.Paragraph:
                cursor = renderParagraph(
                    doc,
                    element,
                    cursor,
                    indent,
                    options,
                    renderElement,
                );
                break;
            case MdTokenType.List:
                cursor = renderList(
                    doc,
                    element,
                    cursor,
                    indentLevel,
                    options,
                    renderElement,
                );
                break;
            case MdTokenType.ListItem:
                cursor = renderListItem(
                    doc,
                    element,
                    cursor,
                    indentLevel,
                    options,
                    renderElement,
                    start,
                    ordered,
                );
                break;
            case MdTokenType.Hr:
                cursor = renderHR(doc, cursor, options);
                break;
            case MdTokenType.Code:
                cursor = renderCodeBlock(
                    doc,
                    element,
                    cursor,
                    indentLevel,
                    hasRawBullet,
                    options,
                );
                break;
            case MdTokenType.Strong:
            case MdTokenType.Em:
                cursor = renderInlineText(
                    doc,
                    element,
                    cursor,
                    indent,
                    options,
                );
                break;
            case MdTokenType.Raw:
            case MdTokenType.Text:
                cursor = renderRawItem(
                    doc,
                    element,
                    cursor,
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
                    with details of the element and expected behavior. Thank you for helping improve this library!`,
                );
                break;
        }
        return cursor;
    };

    for (const item of parsedElements) {
        renderElement(item);
    }

    options.endCursorYHandler(cursor.y);
};
