import {
    marked,
    type MarkedToken,
    type Token,
    type Tokens,
    type TokensList,
} from 'marked';
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

/** Narrow a marked token to the text-token shape used by image attributes. */
const isMarkedTextToken = (token: Token | undefined): token is Tokens.Text =>
    token?.type === MdTokenType.Text &&
    'text' in token &&
    typeof token.text === 'string';

/**
 * Convert the markdown tokens to ParsedElements.
 *
 * @param tokens - The list of markdown tokens.
 * @returns Parsed elements in a custom structure.
 */
const convertTokens = (
    tokens: Token[],
    warnings?: RenderWarnings,
): ParsedElement[] => {
    const parsedElements: ParsedElement[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        try {
            const handler = tokenHandlers[token.type as MarkedToken['type']] as
                | ((token: Token, warnings?: RenderWarnings) => ParsedElement)
                | undefined;
            if (handler) {
                const element = handler(token, warnings);
                parsedElements.push(element);
                if (element.type === MdTokenType.Image) {
                    // `{width=… align=…}` arrives as the start of the text
                    // token after the image. A token left empty by removing
                    // it is skipped, so a lone image still parses as a single
                    // block image rather than an image followed by text.
                    const next = tokens[i + 1];
                    const nextText = isMarkedTextToken(next) ? next : undefined;
                    const taken = nextText
                        ? takeImageAttributes(nextText.text, warnings)
                        : null;
                    if (taken && nextText) {
                        Object.assign(element, taken.attrs);
                        if (taken.rest) {
                            nextText.text = taken.rest;
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

/*
 * HTML helpers.
 *
 * An HTML token can run to the end of the document, so these must stay linear
 * in its length. The regexes they replace — `/^<(\w+)[^>]*>(.*?)<\/\1>$/is`,
 * `/<!--[\s\S]*?-->/g` and `/<[^>]*>/g` — each rescanned the rest of the token
 * from every candidate start, and 60 KB of crafted HTML took seconds.
 */

/**
 * Splits `<tag …>inner</tag>` into its lower-cased tag name and inner text,
 * when `raw` both starts and ends with the same tag.
 *
 * Matches exactly what `/^<(\w+)[^>]*>(.*?)<\/\1>$/is` did, starting from the
 * closing tag so the name is known before the opening tag is examined.
 */
const matchWrappingTag = (
    raw: string,
): { tag: string; inner: string } | null => {
    if (!raw.endsWith('>')) return null;
    const closeStart = raw.lastIndexOf('</');
    if (closeStart < 1) return null;
    const name = raw.slice(closeStart + 2, -1);
    if (!/^\w+$/.test(name)) return null;

    // The opening tag starts with the same name; anything up to its first
    // '>' is attributes.
    const tag = name.toLowerCase();
    if (raw[0] !== '<') return null;
    if (raw.slice(1, 1 + name.length).toLowerCase() !== tag) return null;
    const openEnd = raw.indexOf('>', 1 + name.length);
    if (openEnd === -1 || openEnd >= closeStart) return null;

    return { tag, inner: raw.slice(openEnd + 1, closeStart) };
};

/** Removes every complete `<!-- … -->` comment. */
const stripComments = (raw: string): string => {
    let out = '';
    let from = 0;
    for (;;) {
        const start = raw.indexOf('<!--', from);
        const end = start === -1 ? -1 : raw.indexOf('-->', start + 4);
        // An unterminated comment is left as text, as no later one can close.
        if (end === -1) return out + raw.slice(from);
        out += raw.slice(from, start);
        from = end + 3;
    }
};

/** Removes every `<…>` run, each ending at the first `>` after its `<`. */
const stripTags = (raw: string): string => {
    let out = '';
    let from = 0;
    for (;;) {
        const start = raw.indexOf('<', from);
        const end = start === -1 ? -1 : raw.indexOf('>', start + 1);
        if (end === -1) return out + raw.slice(from);
        out += raw.slice(from, start);
        from = end + 1;
    }
};

/**
 * Map each token type to its handler function.
 */
type TokenWithOptionalChildren<T extends Token> = T & { tokens?: Token[] };

// Keep each handler key coupled to the corresponding marked token shape.
type TokenHandlers = {
    [K in MarkedToken['type']]?: (
        token: Extract<MarkedToken, { type: K }>,
        warnings?: RenderWarnings,
    ) => ParsedElement;
};

const tokenHandlers: TokenHandlers = {
    [MdTokenType.Heading]: (token: Tokens.Heading, warnings) => ({
        type: MdTokenType.Heading,
        depth: token.depth,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Paragraph]: (token: Tokens.Paragraph, warnings) => ({
        type: MdTokenType.Paragraph,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.List]: (token: Tokens.List, warnings) => ({
        type: MdTokenType.List,
        ordered: token.ordered,
        // Marked uses '' for unordered lists; the renderer only reads `start`
        // for ordered lists, so preserving the existing cast is safe.
        start: token.start as ParsedElement['start'],
        items: token.items ? convertTokens(token.items, warnings) : [],
    }),
    [MdTokenType.ListItem]: (token: Tokens.ListItem, warnings) => ({
        type: MdTokenType.ListItem,
        content: token.text,
        task: token.task ?? false,
        checked: token.checked ?? false,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Code]: (token: Tokens.Code) => ({
        type: MdTokenType.Code,
        lang: token.lang,
        code: token.text,
    }),
    [MdTokenType.Table]: (token: Tokens.Table, warnings) => ({
        type: MdTokenType.Table,
        // `align` comes straight from the delimiter row (`|:--|--:|`) and was
        // previously discarded, so every column rendered left-aligned.
        columnAlign: token.align ?? [],
        header: token.header.map((header) => ({
            type: MdTokenType.TableHeader,
            content: header.text,
            items: header.tokens ? convertTokens(header.tokens, warnings) : [],
        })),
        rows: token.rows.map((row) =>
            row.map((cell) => ({
                type: MdTokenType.TableCell,
                content: cell.text,
                items: cell.tokens ? convertTokens(cell.tokens, warnings) : [],
            })),
        ),
    }),
    // Width, height and alignment come from a trailing `{…}` block and are
    // applied by `convertTokens`, which can see the token that follows.
    [MdTokenType.Image]: (token: Tokens.Image) => ({
        type: MdTokenType.Image,
        src: token.href,
        alt: token.text,
        width: undefined,
        height: undefined,
        align: undefined,
    }),
    [MdTokenType.Link]: (token: Tokens.Link, warnings) => ({
        type: MdTokenType.Link,
        href: token.href,
        text: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Strong]: (token: Tokens.Strong, warnings) => ({
        type: MdTokenType.Strong,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Em]: (token: Tokens.Em, warnings) => ({
        type: MdTokenType.Em,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Text]: (token: Tokens.Text, warnings) => ({
        type: MdTokenType.Text,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Hr]: (
        token: TokenWithOptionalChildren<Tokens.Hr>,
        warnings,
    ) => ({
        type: MdTokenType.Hr,
        content: token.raw,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.CodeSpan]: (
        token: TokenWithOptionalChildren<Tokens.Codespan>,
        warnings,
    ) => ({
        type: MdTokenType.CodeSpan,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Blockquote]: (token: Tokens.Blockquote, warnings) => ({
        type: MdTokenType.Blockquote,
        content: token.text,
        items: token.tokens ? convertTokens(token.tokens, warnings) : [],
    }),
    [MdTokenType.Html]: (token: Tokens.HTML | Tokens.Tag) => {
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

        const inlineMatch = matchWrappingTag(raw);
        if (inlineMatch) {
            const mappedType = inlineTagMap[inlineMatch.tag];
            if (mappedType) {
                return { type: mappedType, content: inlineMatch.inner };
            }
        }

        if (/^<(s|del)[^>]*>(.*?)<\/(s|del)>$/is.test(raw)) {
            const textMatch = raw.match(/>([^<]+)</);
            return { type: MdTokenType.Raw, content: textMatch?.[1] ?? raw };
        }

        // Unknown HTML: render as raw text, strip tags.
        // Comments are removed first and as whole units: a tag ends at the
        // first '>', so `<!-- a > b -->` left `b -->` behind as visible text.
        const strippedText = stripTags(stripComments(raw)).trim();
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
    [MdTokenType.Escape]: (token: Tokens.Escape) => ({
        type: MdTokenType.Text,
        content: token.text,
    }),
    // GFM strikethrough. Previously rendered as literal `~~text~~`.
    [MdTokenType.Del]: (token: Tokens.Del, warnings) => ({
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
    [MdTokenType.Space]: (token: Tokens.Space) => ({
        type: MdTokenType.Space,
        content: token.raw,
    }),
};
