import jsPDF from 'jspdf';
import { MdTokenType } from '../enums/mdTokenType';
import { MdTextParser } from '../parser/MdTextParser';
import { ParsedElement } from '../types/parsedElement';
import { RenderOption } from '../types/renderOption';
import { HandlePageBreaks } from '../utils/handlePageBreak';
import {
    renderHeading,
    renderList,
    renderListItem,
    renderParagraph,
    renderRawItem,
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
    console.log(parsedElements);

    let y = options.cursor.y;
    const x = options.cursor.x;

    const renderElement = (
        element: ParsedElement,
        indentLevel: number = 0,
        hasRawBullet: boolean = false,
    ) => {
        const indent = indentLevel * options.page.indent;
        if (
            y +
                doc.splitTextToSize(
                    element.content ?? '',
                    options.page.maxContentWidth - indent,
                ).length *
                    getCharHight(doc, options) >=
            options.page.maxContentHeight
        ) {
            HandlePageBreaks(doc, options);
            y = options.page.topmargin;
        }

        switch (element.type) {
            case MdTokenType.Heading:
                y = renderHeading(doc, element, x, y, indent, options);
                break;
            case MdTokenType.Paragraph:
                y = renderParagraph(doc, element, x, y, indent, options);
                break;
            case MdTokenType.List:
                y = renderList(
                    doc,
                    element,
                    y,
                    indentLevel,
                    options,
                    renderElement,
                );
                break;
            case MdTokenType.ListItem:
                y = renderListItem(
                    doc,
                    element,
                    x,
                    y,
                    indentLevel,
                    options,
                    renderElement,
                );
                break;
            case MdTokenType.Raw:
                y = renderRawItem(
                    doc,
                    element,
                    x,
                    y,
                    indentLevel,
                    hasRawBullet,
                    options,
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
        return y;
    };

    for (const item of parsedElements) {
        renderElement(item);
    }

    options.endCursorYHandler(y);
};
