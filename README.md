# jsPDF Markdown Renderer

A utility to render Markdown directly into formatted PDFs using `jsPDF`.

[![npm version](https://img.shields.io/npm/v/jspdf-md-renderer.svg)](https://www.npmjs.com/package/jspdf-md-renderer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/jspdf-md-renderer.svg)](https://www.npmjs.com/package/jspdf-md-renderer)
[![Node.js CI](https://github.com/JeelGajera/jspdf-md-renderer/actions/workflows/node.js.yml/badge.svg)](https://github.com/JeelGajera/jspdf-md-renderer/actions/workflows/node.js.yml)

## Highlights

- Rich markdown support (headings, lists, tables, images, code, blockquotes, links)
- Configurable typography, spacing, and block styling
- Header/footer and page-number support
- Safe inline layout and long-token wrapping
- Optional security enforcement for untrusted markdown

## Installation

```sh
npm install jspdf-md-renderer
```

## Quick Start

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
  },
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
    maxNestedDepth: 20,
    renderTimeoutMs: 30000,

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

Browser caveat:
- IP-level SSRF checks are best-effort in browser runtime due to DNS API limitations.
- For strict SSRF policy, fetch remote images through a trusted server-side proxy.

## API Exports

- `MdTextRender`
- `MdTextParser`
- `SecurityViolationError`
- `MarkdownParsingLimitError`
- `validateOptions`
- Types: `RenderOption`, `RenderSecurityOptions`, `SecurityViolation`, `ViolationMode`, and others

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
