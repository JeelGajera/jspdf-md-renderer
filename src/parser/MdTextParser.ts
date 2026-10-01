/* eslint-disable @typescript-eslint/no-explicit-any */
import { TokensList, marked } from 'marked';
import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types/parsedElement';
import { takeImageAttributes } from './imageExtension';
import { RenderWarnings } from '../store/renderWarnings';
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
export const MdTextParser = async (
    text: string,
    warnings?: RenderWarnings,
): Promise<ParsedElement[]> => {
    // Hard, unconditional safety limits — always run, regardless of the
    // opt-in `security` option. See src/security/pre-parse-guards.ts.
    enforceAbsoluteMarkdownLengthLimit(text);
    enforceStructuralSafetyLimits(text);

    let tokens: TokensList;
    try {
        tokens = await marked.lexer(text, {
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

    return convertTokens(tokens, warnings);
};

/**
 * Convert the markdown tokens to ParsedElements.
 *
 * @param tokens - The list of markdown tokens.
 * @returns Parsed elements in a custom structure.
 */
const convertTokens = (
    tokens: TokensList | any[],
    warnings?: RenderWarnings,
): ParsedElement[] => {
    const parsedElements: ParsedElement[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        try {
            const handler = tokenHandlers[token.type];
            if (handler) {
                const element = handler(token, warnings);
                parsedElements.push(element);
                if (element.type === MdTokenType.Image) {
                    // `{width=… align=…}` arrives as the start of the text
                    // token after the image. A token left empty by removing
                    // it is skipped, so a lone image still parses as a single
                    // block image rather than an image followed by text.
                    const next = tokens[i + 1];
                    const taken =
                        next?.type === MdTokenType.Text &&
                        typeof next.text === 'string'
                            ? takeImageAttributes(next.text, warnings)
                            : null;
                    if (taken) {
                        Object.assign(element, taken.attrs);
                        if (taken.rest) {
                            next.text = taken.rest;
                        } else {
                            i++;
                        }
                    }
                }
            } else {
                parsedElements.push({
                    type: MdTokenType.Raw,
                    content: token.raw,
                });
            }
        } catch (error) {
            // The token is discarded, so this is content loss: report it rather
            // than only logging it.
            warnings?.warn({
                code: 'TOKEN_CONVERSION_FAILED',
                message: `Failed to convert a '${token?.type}' token: ${String(error)}`,
                context: token?.type,
                droppedNodes: 1,
            });
        }
    }
    return parsedElements;
};

/**
 * Map each token type to its handler function.
 */
const tokenHandlers: Record<
    string,
    (token: any, warnings?: RenderWarnings) => ParsedElement
> = {
    [MdTokenType.Heading]: (token, warnings) => ({
        type: MdTokenType.Heading,
        depth: token.depth,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Paragraph]: (token, warnings) => ({
        type: MdTokenType.Paragraph,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.List]: (token, warnings) => ({
        type: MdTokenType.List,
        ordered: token.ordered,
        start: token.start,
        items: token.items ? convertTokens(token.items, warnings) : [],
    }),
    [MdTokenType.ListItem]: (token, warnings) => ({
        type: MdTokenType.ListItem,
        content: token.text,
        task: token.task ?? false,
        checked: token.checked ?? false,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Code]: (token) => ({
        type: MdTokenType.Code,
        lang: token.lang,
        code: token.text,
    }),
    [MdTokenType.Table]: (token, warnings) => ({
        type: MdTokenType.Table,
        // `align` comes straight from the delimiter row (`|:--|--:|`) and was
        // previously discarded, so every column rendered left-aligned.
        columnAlign: token.align ?? [],
        header: token.header.map((header: any) => ({
            type: MdTokenType.TableHeader,
            content: header.text,
            items: header.tokens ? convertTokens(header.tokens, warnings) : [],
        })),
        rows: token.rows.map((row: any[]) =>
            row.map((cell: any) => ({
                type: MdTokenType.TableCell,
                content: cell.text,
                items: cell.tokens ? convertTokens(cell.tokens, warnings) : [],
            })),
        ),
    }),
    // Width, height and alignment come from a trailing `{…}` block and are
    // applied by `convertTokens`, which can see the token that follows.
    [MdTokenType.Image]: (token) => ({
        type: MdTokenType.Image,
        src: token.href,
        alt: token.text,
        width: undefined,
        height: undefined,
        align: undefined,
    }),
    [MdTokenType.Link]: (token, warnings) => ({
        type: MdTokenType.Link,
        href: token.href,
        text: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Strong]: (token, warnings) => ({
        type: MdTokenType.Strong,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Em]: (token, warnings) => ({
        type: MdTokenType.Em,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Text]: (token, warnings) => ({
        type: MdTokenType.Text,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Hr]: (token, warnings) => ({
        type: MdTokenType.Hr,
        content: token.raw,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.CodeSpan]: (token, warnings) => ({
        type: MdTokenType.CodeSpan,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Blockquote]: (token, warnings) => ({
        type: MdTokenType.Blockquote,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
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
    [MdTokenType.Del]: (token, warnings) => ({
        type: MdTokenType.Del,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
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
