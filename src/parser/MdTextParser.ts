/* eslint-disable @typescript-eslint/no-explicit-any */
import { TokensList, marked } from 'marked';
import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types/parsedElement';

/**
 * Parses markdown into tokens and converts to a custom parsed structure.
 *
 * @param text - The markdown content to parse.
 * @returns Parsed markdown elements.
 */
export const MdTextParser = async (text: string): Promise<ParsedElement[]> => {
    const tokens = await marked.lexer(text, { async: true });
    return convertTokens(tokens);
};

/**
 * Convert the markdown tokens to ParsedElements.
 *
 * @param tokens - The list of markdown tokens.
 * @returns Parsed elements in a custom structure.
 */
const convertTokens = (tokens: TokensList): ParsedElement[] => {
    const parsedElements: ParsedElement[] = [];
    tokens.forEach((token) => {
        const handler = tokenHandlers[token.type];
        if (handler) {
            parsedElements.push(handler(token));
        } else {
            parsedElements.push({ type: MdTokenType.Raw, content: token.raw });
        }
    });
    return parsedElements;
};

/**
 * Map each token type to its handler function.
 */
const tokenHandlers: Record<string, (token: any) => ParsedElement> = {
    [MdTokenType.Heading]: (token) => ({
        type: MdTokenType.Heading,
        depth: token.depth,
        content: token.text,
    }),
    [MdTokenType.Paragraph]: (token) => ({
        type: MdTokenType.Paragraph,
        content: token.text,
    }),
    [MdTokenType.List]: (token) => ({
        type: MdTokenType.List,
        items: token.items ? convertTokens(token.items) : [],
    }),
    [MdTokenType.ListItem]: (token) => ({
        type: MdTokenType.ListItem,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    [MdTokenType.Code]: (token) => ({
        type: MdTokenType.Code,
        lang: token.lang,
        code: token.text,
    }),
    [MdTokenType.Table]: (token) => ({
        type: MdTokenType.Table,
        header: token.header.map((header: any) => ({
            type: MdTokenType.TableHeader,
            content: header,
        })),
        rows: token.rows.map((row: any[]) =>
            row.map((cell: any) => ({
                type: MdTokenType.TableCell,
                content: cell,
            })),
        ),
    }),
    [MdTokenType.Image]: (token) => ({
        type: MdTokenType.Image,
        src: token.href,
        alt: token.text,
    }),
    [MdTokenType.Link]: (token) => ({
        type: MdTokenType.Link,
        href: token.href,
        text: token.text,
    }),
    [MdTokenType.Strong]: (token) => ({
        type: MdTokenType.Strong,
        content: token.text,
    }),
    [MdTokenType.Em]: (token) => ({
        type: MdTokenType.Em,
        content: token.text,
    }),
};
