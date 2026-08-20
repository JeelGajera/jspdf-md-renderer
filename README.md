# jsPDF Markdown Renderer

A utility to render Markdown directly into formatted PDFs using `jsPDF`.

[![npm version](https://img.shields.io/npm/v/jspdf-md-renderer.svg)](https://www.npmjs.com/package/jspdf-md-renderer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/jspdf-md-renderer.svg)](https://www.npmjs.com/package/jspdf-md-renderer)
[![Node.js CI](https://github.com/JeelGajera/jspdf-md-renderer/actions/workflows/node.js.yml/badge.svg)](https://github.com/JeelGajera/jspdf-md-renderer/actions/workflows/node.js.yml)

## Highlights

- Rich markdown support (headings, lists, tables, images, code, blockquotes, links)
- Page geometry derived from margins — no manual content-area arithmetic
- Overridable block renderers, so you can draw any block yourself
- A render result reporting anything that could not be drawn
- Configurable typography, spacing, and block styling
- Header/footer and page-number support
- Safe inline layout and long-token wrapping
- Optional security enforcement for untrusted markdown

## Installation

`jspdf`, `jspdf-autotable` and `marked` are peer dependencies — the renderer
draws into a `jsPDF` document you construct, so it uses the copy your project
already has rather than bundling a second one.

```sh
npm install jspdf-md-renderer jspdf jspdf-autotable marked
```

| Peer | Supported |
| --- | --- |
| `jspdf` | `^2 \|\| ^3 \|\| ^4` |
| `jspdf-autotable` | `^3 \|\| ^4 \|\| ^5` |
| `marked` | `^18` |

`marked`'s range is deliberately narrow: its tokenizer output is this library's
layout input, and earlier majors emit different blank-line tokens that move
content vertically on the page.

## Quick Start

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender } from 'jspdf-md-renderer'

const doc = new jsPDF({ unit: 'mm', format: 'a4' })

const result = await MdTextRender(doc, '# Report\n\nWith **formatted** markdown.', {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: { regular: { name: 'helvetica', style: 'normal' } },
})

if (result.warnings.length) {
  console.warn('Some content could not be rendered:', result.warnings)
}

doc.save('report.pdf')
```

The content area is derived from the document's own page size, so it stays
correct across formats and orientations. Everything else has a default.

<details>
<summary>Full configuration, with explicit geometry</summary>

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender } from 'jspdf-md-renderer'

const markdown = `
# Project Report

This report includes **formatted markdown** content.

- Item 1
- Item 2
`

const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

await MdTextRender(doc, markdown, {
  cursor: { x: 10, y: 10 },
  page: {
    format: 'a4',
    unit: 'mm',
    orientation: 'portrait',
    maxContentWidth: 190,
    maxContentHeight: 277,
    lineSpace: 1.5,
    defaultLineHeightFactor: 1.2,
    defaultFontSize: 12,
    defaultTitleFontSize: 14,
    topmargin: 10,
    xpading: 10,
    xmargin: 10,
    indent: 10,
  },
  font: {
    bold: { name: 'helvetica', style: 'bold' },
    regular: { name: 'helvetica', style: 'normal' },
    light: { name: 'helvetica', style: 'light' },
  },
  endCursorYHandler: (y) => {
    console.log('Final Y:', y)
  },
})

doc.save('report.pdf')
```

</details>

## Render Result

`MdTextRender` resolves to a summary of what it drew — and what it could not.

```ts
const { endY, startPage, pageCount, warnings, droppedNodes, violations } =
  await MdTextRender(doc, markdown, options)
```

| Field | Meaning |
| --- | --- |
| `endY` | Y position of the cursor when rendering finished |
| `startPage` | Page the render began on |
| `pageCount` | Pages this render produced |
| `warnings` | Everything that could not be drawn, with a code and context |
| `droppedNodes` | How much content that cost |
| `violations` | Security violations raised during the render |

Failures were previously silent — an image that failed to load, an unsupported
element, or a subtree past the nesting limit produced a PDF that looked
successful and was not. Check `warnings` if a document must be complete.

```ts
// React to warnings as they happen, and keep the console quiet
await MdTextRender(doc, markdown, {
  ...options,
  silent: true,
  onWarning: (w) => logger.warn(w.code, w.message, w.context),
})
```

## Custom Components

Replace or decorate any block renderer. `ctx.next()` runs the built-in, so an
override can wrap it rather than reimplement it.

```ts
await MdTextRender(doc, markdown, {
  ...options,
  components: {
    heading: (ctx) => {
      if (ctx.element.depth === 1) {
        ctx.doc.setFillColor('#1A365D')
        ctx.doc.rect(ctx.x, ctx.y, ctx.maxWidth, 10, 'F')
      }
      ctx.next()
    },
    code: (ctx) => myHighlighter(ctx),
  },
})
```

Overridable: `heading`, `paragraph`, `list`, `listItem`, `blockquote`, `code`,
`table`, `image`, `hr`.

The context carries `doc`, `element`, `indentLevel`, `indent`, `x`, `y`,
`maxWidth`, `store` and `options`, plus `next()` and
`render(element, indentLevel?)` for laying out children. An override that throws
is reported as a warning and falls back to the built-in renderer, so a mistake
degrades to default output rather than losing the block.

## Custom Fonts

`registerFont` handles the `addFileToVFS`/`addFont` wiring and returns the
`font` config that selects the result.

```ts
import { registerFont } from 'jspdf-md-renderer'

const inter = registerFont(doc, {
  family: 'Inter',
  variants: { normal: regularBase64, bold: boldBase64, italic: italicBase64 },
})

await MdTextRender(doc, markdown, { ...options, font: inter.font })
```

Styles with no data registered fall back to the normal face, so text stays in
the intended family instead of silently reverting to a core font.

## Browser Usage

### Bundler (Vite/Webpack/Rollup)

```ts
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { MdTextRender } from 'jspdf-md-renderer'
```

### Script Tag (UMD)

```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@latest/dist/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@latest/dist/jspdf.plugin.autotable.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf-md-renderer@latest/dist/index.umd.js"></script>
<script>
  const { jsPDF } = window.jspdf;
  const { MdTextRender } = window.JspdfMdRenderer;
</script>
```

## Supported Markdown

- Headings (`#` to `######`)
- Paragraphs
- Ordered/unordered/task lists
- Links
- Images (with optional `{width,height,align}` attributes)
- Tables
- Code blocks and inline code
- Blockquotes
- Horizontal rules
- Inline styles (bold/italic)

## Key Render Options

```ts
const options = {
  heading: {
    bold: true,
    h1: 26,
    h2: 22,
    h3: 18,
    bottomSpacing: 3,
  },
  list: {
    bulletChar: '\u2022 ',
    indentSize: 8,
    itemSpacing: 0,
  },
  paragraph: {
    bottomSpacing: 3,
    color: '#111827',
  },
  blockquote: {
    barColor: '#4A90D9',
    barWidth: 2,
    paddingLeft: 6,
    backgroundColor: '#F8FAFC',
  },
  codeBlock: {
    backgroundColor: '#F6F8FA',
    borderColor: '#E1E4E8',
    borderRadius: 3,
    padding: 5,
    showLanguageLabel: true,
    textColor: '#111827',
  },
  spacing: {
    afterHeading: 2,
    afterParagraph: 4,
    afterCodeBlock: 4,
    afterBlockquote: 3,
    afterImage: 2,
    afterHR: 2,
    betweenListItems: 0,
    afterList: 3,
    afterTable: 3,
    // 'collapse' makes the values above the only source of inter-block gaps.
    // Default 'preserve' also adds a line per blank line in the source.
    blankLines: 'preserve',
  },
  // true (default): a single newline is a hard line break.
  // false: a single newline is a space, per CommonMark.
  breaks: true,
  header: {
    text: 'My Report',
    align: 'center',
    color: '#6b7280',
    fontSize: 9,
  },
  footer: {
    showPageNumbers: true,
    align: 'right',
  },
}
```

Behavior notes:
- Heading size fallback: `heading.hN` -> `page.defaultTitleFontSize`
- `heading.bold` defaults to `true`
- List spacing precedence: `spacing.betweenListItems` > `list.itemSpacing`
- Table width follows `page.maxContentWidth` for consistent block layout

## Layout Compatibility Options

Two options control behaviour that is scheduled to change. Both default to the
behaviour of 4.1.x, so upgrading does not move anything on an existing page.
Setting them explicitly makes the next major upgrade a no-op too.

| Option | Current default | Next major | What `collapse` / `false` does |
| --- | --- | --- | --- |
| `spacing.blankLines` | `'preserve'` | `'collapse'` | Blank lines in the source stop adding vertical space, so the `spacing.*` options alone decide the gap between blocks |
| `breaks` | `true` | `false` | A single newline inside a paragraph renders as a space rather than a hard line break, per CommonMark |

```ts
// Opt in to the corrected behaviour today
const options = {
  // ...other options
  spacing: { blankLines: 'collapse' },
  breaks: false,
}
```

## Known Limitations

- Inline emphasis inside table cells is flattened to plain text. `jspdf-autotable`
  draws cell content itself and has no notion of mixed inline runs.
- Inline HTML tags (`<strong>`, `<em>`) render their text without applying the
  style. `<br>` is supported.
- `cursor.x` applies to the first line only; each block then starts at the left
  edge of the content column.
- Long runs of CJK text wrap character by character, without kinsoku rules.

## Security Controls (opt-in)

Security is disabled by default for backward compatibility.

> **Always-on baseline limits (cannot be disabled):**
> Regardless of the `security.enabled` setting, `MdTextParser` (and by extension
> `MdTextRender`) enforces two unconditional hard limits to prevent the underlying
> Markdown parser from crashing the host process:
>
> - **Absolute length ceiling:** Inputs larger than **2 MB** (2,000,000 characters) are
>   rejected with a `MarkdownParsingLimitError` before parsing begins.
> - **Structural nesting ceiling:** Blockquote or list structures nested more than
>   **300 levels** deep are rejected with a `MarkdownParsingLimitError`.
>
> These limits exist because deeply nested or oversized Markdown can cause stack
> exhaustion or memory exhaustion in the parser regardless of any security settings.
> `MarkdownParsingLimitError` is exported from `jspdf-md-renderer` and can be caught
> and handled by callers.

```ts
const options = {
  // ...other options
  security: {
    enabled: true,
    violationMode: 'skip', // 'skip' | 'throw' | 'placeholder'
    placeholderText: '[blocked]',
    placeholderImageText: '[blocked image]',

    // Link controls
    allowedLinkProtocols: ['https:', 'http:', 'mailto:', 'tel:'],
    disablePdfLinks: false,

    // Image controls
    allowRemoteImages: true,
    allowedImageProtocols: ['https:', 'http:'],
    allowedImageDomains: ['cdn.example.com'],
    allowDataUrls: true,
    allowSvgImages: true,

    // SSRF controls
    blockLocalhost: true,
    blockPrivateIPs: true,
    blockLinkLocalIPs: true,
    blockMetadataIPs: true,

    // Limits
    maxMarkdownLength: 500000,
    maxImageCount: 200,
    maxImageSizeBytes: 10 * 1024 * 1024,
    maxNestedDepth: 20,     // counts structural nesting (lists, quotes, tables)
    renderTimeoutMs: 30000,
    imageFetchTimeoutMs: 10000, // per remote image request; 0 disables

    // Hooks
    validateUrl: async (url, type) => true,
    onSecurityViolation: (violation) => console.warn(violation),
  },
}
```

### Security Details

- URL classes:
  - explicit scheme (`https://...`) -> full protocol/domain/IP checks
  - protocol-relative (`//host/path`) -> treated as external absolute URL
  - relative path (`/a`, `./a`, `?q=1`, `#id`) -> allowed by default unless custom validator rejects
- `allowedImageDomains` semantics:
  - `undefined` -> allow all domains
  - `[]` -> deny all domains
- `maxImageSizeBytes` uses decoded bytes for data URLs
- `SecurityViolationError` is exported for throw-mode handling
- Redirects on remote image fetches are followed manually, and every hop is
  revalidated against the same policy (bounded to 5 hops)
- `maxNestedDepth` counts structural containers (lists, list items, blockquotes,
  tables), not every AST level

Browser caveat:
- IP-level SSRF checks are best-effort in browser runtime due to DNS API limitations.
- For strict SSRF policy, fetch remote images through a trusted server-side proxy.

## API Exports

- `MdTextRender` — renders markdown, resolves to a `RenderResult`
- `MdTextParser`
- `registerFont`
- `validateOptions`
- `SecurityViolationError`
- `MarkdownParsingLimitError`
- Types: `RenderOption`, `RenderResult`, `RenderWarning`, `PageMargin`,
  `ComponentContext`, `ComponentOverrides`, `RegisteredFont`,
  `RenderSecurityOptions`, `SecurityViolation`, `ViolationMode`, and others

All types are exported from the package root:

```ts
import type { RenderOption } from 'jspdf-md-renderer'
```

## Examples and Docs

- Docs site: [https://jeelgajera.github.io/jspdf-md-renderer/](https://jeelgajera.github.io/jspdf-md-renderer/)
- Resume example: [https://jeelgajera.github.io/jspdf-md-renderer/examples/resume](https://jeelgajera.github.io/jspdf-md-renderer/examples/resume)
- Invoice example: [https://jeelgajera.github.io/jspdf-md-renderer/examples/invoice](https://jeelgajera.github.io/jspdf-md-renderer/examples/invoice)
- Technical report example: [https://jeelgajera.github.io/jspdf-md-renderer/examples/report](https://jeelgajera.github.io/jspdf-md-renderer/examples/report)

## Testing

This repository uses **Vitest** for regression testing and coverage reporting.

```sh
npm test         # Run tests with coverage
npm run test:watch
npm run test:ui
```

Coverage policy:
- Security/rendering behavior changes should include focused regression tests.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
