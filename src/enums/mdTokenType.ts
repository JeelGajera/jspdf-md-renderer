export enum MdTokenType {
    Heading = 'heading',
    Paragraph = 'paragraph',
    List = 'list',
    ListItem = 'list_item',
    Blockquote = 'blockquote',
    Code = 'code',
    CodeSpan = 'codespan',
    Table = 'table',
    Html = 'html',
    Hr = 'hr',
    Image = 'image',
    Link = 'link',
    Strong = 'strong',
    Em = 'em',
    TableHeader = 'table_header',
    TableCell = 'table_cell',
    Raw = 'raw',
    Text = 'text',
    Br = 'br',
    Del = 'del',
    Escape = 'escape',
    Def = 'def',
    /** Parsed but intentionally renders nothing (e.g. link reference definitions). */
    Noop = 'noop',
}

/**
 * Block-level tokens that the inline layout engine cannot represent.
 *
 * `flattenToWords` builds words from a node's `content`/`text`, so a token that
 * carries its payload elsewhere — a fenced code block keeps its source in
 * `code`, a table in `header`/`rows` — produces no words and is dropped without
 * a warning. These must always be delegated to their own component renderer.
 */
export const NON_INLINE_TYPES: ReadonlySet<string> = new Set<string>([
    MdTokenType.Code,
    MdTokenType.Table,
    MdTokenType.Hr,
    MdTokenType.Blockquote,
]);
