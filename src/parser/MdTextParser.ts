/* eslint-disable @typescript-eslint/no-explicit-any */
import { TokensList, marked } from 'marked';
import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types/parsedElement';
import {
    preprocessImageAttributes,
    parseImageAttrsFromHref,
} from './imageExtension';
import {
    enforceAbsoluteMarkdownLengthLimit,
    enforceStructuralSafetyLimits,
    MarkdownParsingLimitError,
} from '../security/pre-parse-guards';

/**
 * Parses markdown into tokens and converts to a custom parsed structure.
 *
 * @param text - The markdown content to parse.
 * @returns Parsed markdown elements.
 */
export const MdTextParser = async (text: string): Promise<ParsedElement[]> => {
    // Hard, unconditional safety limits — always run, regardless of the
    // opt-in `security` option. See src/security/pre-parse-guards.ts.
    enforceAbsoluteMarkdownLengthLimit(text);
    enforceStructuralSafetyLimits(text);

    // Pre-process: encode {width=N height=N align=X} into image URL fragments
    const processedText = preprocessImageAttributes(text);

    let tokens: TokensList;
    try {
        tokens = await marked.lexer(processedText, {
            async: true,
            gfm: true,
        });
    } catch (error) {
        // Convert an uncaught parser crash (e.g. stack overflow on
        // pathological input that slipped past the structural heuristic
        // above) into a typed, catchable error instead of letting it
        // propagate as a raw RangeError/unhandled rejection.
        throw new MarkdownParsingLimitError(
            `[jspdf-md-renderer] Markdown parsing failed, likely due to excessive ` +
                `structural complexity in the input. Original error: ${
                    error instanceof Error ? error.message : String(error)
                }`,
        );
    }

    return convertTokens(tokens);
};

/**
 * Convert the markdown tokens to ParsedElements.
 *
 * @param tokens - The list of markdown tokens.
 * @returns Parsed elements in a custom structure.
 */
const convertTokens = (tokens: TokensList | any[]): ParsedElement[] => {
    const parsedElements: ParsedElement[] = [];
    tokens.forEach((token) => {
        try {
            const handler = tokenHandlers[token.type];
            if (handler) {
                parsedElements.push(handler(token));
            } else {
                parsedElements.push({
                    type: MdTokenType.Raw,
                    content: token.raw,
                });
            }
        } catch (error) {
            console.error('Failed to handle token ==>', token, error);
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
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    [MdTokenType.Paragraph]: (token) => ({
        type: MdTokenType.Paragraph,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    [MdTokenType.List]: (token) => ({
        type: MdTokenType.List,
        ordered: token.ordered,
        start: token.start,
        items: token.items ? convertTokens(token.items) : [],
    }),
    [MdTokenType.ListItem]: (token) => ({
        type: MdTokenType.ListItem,
        content: token.text,
        task: token.task ?? false,
        checked: token.checked ?? false,
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    [MdTokenType.Code]: (token) => ({
        type: MdTokenType.Code,
        lang: token.lang,
        code: token.text,
    }),
    [MdTokenType.Table]: (token) => ({
        type: MdTokenType.Table,
        // `align` comes straight from the delimiter row (`|:--|--:|`) and was
        // previously discarded, so every column rendered left-aligned.
        columnAlign: token.align ?? [],
        header: token.header.map((header: any) => ({
            type: MdTokenType.TableHeader,
            content: header.text,
            items: header.tokens ? convertTokens(header.tokens) : [],
        })),
        rows: token.rows.map((row: any[]) =>
            row.map((cell: any) => ({
                type: MdTokenType.TableCell,
                content: cell.text,
                items: cell.tokens ? convertTokens(cell.tokens) : [],
            })),
        ),
    }),
    [MdTokenType.Image]: (token) => {
        // Decode attributes from URL fragment and get clean URL
        const { cleanHref, attrs } = parseImageAttrsFromHref(token.href);
        return {
            type: MdTokenType.Image,
            src: cleanHref,
            alt: token.text,
            width: attrs.width,
            height: attrs.height,
            align: attrs.align,
        };
    },
    [MdTokenType.Link]: (token) => ({
        type: MdTokenType.Link,
        href: token.href,
        text: token.text,
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    [MdTokenType.Strong]: (token) => ({
        type: MdTokenType.Strong,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    [MdTokenType.Em]: (token) => ({
        type: MdTokenType.Em,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    [MdTokenType.Text]: (token) => ({
        type: MdTokenType.Text,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    [MdTokenType.Hr]: (token) => ({
        type: MdTokenType.Hr,
        content: token.raw,
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    [MdTokenType.CodeSpan]: (token) => ({
        type: MdTokenType.CodeSpan,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    [MdTokenType.Blockquote]: (token) => ({
        type: MdTokenType.Blockquote,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    [MdTokenType.Html]: (token) => {
        const raw = String(token.raw ?? token.text ?? '').trim();

        if (/^<br\s*\/?>$/i.test(raw)) {
            return { type: MdTokenType.Br, content: '\n' };
        }

        // Support common inline HTML tags by mapping them to known types
        const inlineTagMap: Record<string, string> = {
            strong: MdTokenType.Strong,
            b: MdTokenType.Strong,
            em: MdTokenType.Em,
            i: MdTokenType.Em,
        };

        const inlineMatch = raw.match(/^<(\w+)[^>]*>(.*?)<\/\1>$/is);
        if (inlineMatch) {
            const tag = inlineMatch[1].toLowerCase();
            const innerText = inlineMatch[2];
            const mappedType = inlineTagMap[tag];
            if (mappedType) {
                return { type: mappedType, content: innerText };
            }
        }

        if (/^<(s|del)[^>]*>(.*?)<\/(s|del)>$/is.test(raw)) {
            const textMatch = raw.match(/>([^<]+)</);
            return { type: MdTokenType.Raw, content: textMatch?.[1] ?? raw };
        }

        // Unknown HTML: render as raw text, strip tags.
        // Comments are removed first and as whole units: `<[^>]+>` stops at the
        // first '>', so `<!-- a > b -->` left `b -->` behind as visible text.
        const strippedText = raw
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<[^>]*>/g, '')
            .trim();
        if (strippedText) {
            return { type: MdTokenType.Raw, content: strippedText };
        }

        // HTML that carries no text of its own — an opening or closing tag on
        // its own token, or a comment — must not reach the layout as an empty
        // `raw` block. Doing so flushed the surrounding inline buffer and broke
        // the sentence onto a new line at every tag boundary.
        return {
            type: MdTokenType.Noop,
            content: '',
        };
    },
    [MdTokenType.Br]: () => ({
        type: MdTokenType.Br,
        content: '\n',
    }),
    // An escape token carries the escaped character in `text` and the source
    // backslash in `raw`. Falling through to the generic `raw` branch printed
    // the backslash, so `\\*` rendered as `\\*` instead of `*`.
    [MdTokenType.Escape]: (token) => ({
        type: MdTokenType.Text,
        content: token.text,
    }),
    // GFM strikethrough. Previously rendered as literal `~~text~~`.
    [MdTokenType.Del]: (token) => ({
        type: MdTokenType.Del,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens) : [],
    }),
    // A link reference definition is metadata, not content. It was being
    // printed into the document as body text.
    [MdTokenType.Def]: () => ({
        type: MdTokenType.Noop,
        content: '',
    }),
    // Blank lines between blocks. Marked emits these as their own tokens; they
    // used to fall through to the generic `raw` branch and be turned into extra
    // vertical space on top of the configured `spacing.*` values. Labelling
    // them lets the renderer decide, per `spacing.blankLines`.
    [MdTokenType.Space]: (token) => ({
        type: MdTokenType.Space,
        content: token.raw,
    }),
};
