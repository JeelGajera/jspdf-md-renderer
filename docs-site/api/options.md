---
title: Options Reference
description: Complete RenderOption reference for jspdf-md-renderer, including security controls.
llm_summary: |
  RenderOption reference with page/font/layout controls, heading and list behavior,
  spacing precedence rules, and security options with violation modes and defaults.
---

# Options Reference

`RenderOption` controls layout, typography, spacing, rendering behavior, and optional security enforcement.

## Minimal Required Shape

```ts
import type { RenderOption } from 'jspdf-md-renderer'

const options: RenderOption = {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: { regular: { name: 'helvetica', style: 'normal' } },
}
```

That is a complete configuration. `font.regular` is the only value you must
supply; everything else has a default.

## Page Geometry

`page.margin` derives the content area from the document's own page size, so it
stays correct across formats and orientations.

```ts
page: {
  margin: { top: 20, right: 20, bottom: 25, left: 20 },
}
```

Omitted sides default to `10`. Rendering starts at the top-left of the content
area unless you set `cursor`.

### Explicit geometry (deprecated)

The individual geometry fields still work and still win when both are given, so
a partial migration is safe.

```ts
page: {
  maxContentWidth: 190,   // width of the content column
  maxContentHeight: 277,  // absolute Y of the content bottom — not a height
  topmargin: 10,
  xpading: 10,            // left edge of the content column
  xmargin: 10,            // horizontal margin for headers and footers
}
```

Keeping these consistent with the page format is manual, and `maxContentWidth`
and `maxContentHeight` are not the same kind of quantity despite the matching
names. Prefer `page.margin`.

### Fonts

```ts
font: {
  regular: { name: 'helvetica', style: 'normal' },  // required
  bold: { name: 'helvetica', style: 'bold' },       // defaults to helvetica bold
  italic: { name: 'helvetica', style: 'italic' },
  boldItalic: { name: 'helvetica', style: 'bolditalic' },
  code: { name: 'courier', style: 'normal' },
}
```

`font.light` is accepted but never read; it is deprecated and has no effect.

See [Custom Fonts](/examples/custom-fonts) for registering a non-core font.

## Layout and Typography

### Heading

```ts
heading: {
  bold: true,
  h1: 26,
  h2: 22,
  h3: 18,
  h4: 16,
  h5: 13,
  h6: 11,
  bottomSpacing: 3,
  color: '#1A365D',
  h1Color: '#7B2D00',
}
```

Behavior notes:
- `heading.bold` defaults to `true`.
- Size fallback chain is: `heading.hN` -> `page.defaultTitleFontSize`.

### Lists and Spacing

```ts
list: {
  bulletChar: '\u2022 ',
  indentSize: 8,
  itemSpacing: 0,
},
spacing: {
  betweenListItems: 1,
  afterList: 3,
}
```

Spacing precedence:
- `spacing.betweenListItems` has higher priority.
- `list.itemSpacing` is used only when `spacing.betweenListItems` is not set.

### Blank Lines Between Blocks

```ts
spacing: {
  blankLines: 'preserve', // 'preserve' | 'collapse'
}
```

Controls whether blank lines in the Markdown source add vertical space on top of
the configured `spacing.*` values.

- `'preserve'` (default) — each blank line adds a line of space in addition to
  the `spacing.*` value. This is the historical behaviour, so existing documents
  render unchanged.
- `'collapse'` — blank lines add nothing, so the `spacing.*` options alone
  determine the gap between blocks. The gap no longer varies with how many blank
  lines the author happened to leave in the source.

Use `'collapse'` when you want spacing to be fully determined by your
configuration. See [Scheduled default changes](#scheduled-default-changes).

### Line Breaks

```ts
breaks: true // top-level option, not nested under `page`
```

Controls how a single newline inside a paragraph is rendered.

- `true` (default) — renders a hard line break. Historical behaviour.
- `false` — renders a space, which is what CommonMark specifies for a soft line
  break.

An explicit `<br>` always breaks the line regardless of this setting.

### Blockquotes

```ts
blockquote: {
  barColor: '#AAAAAA',
  barWidth: 1,
  paddingLeft: 4,
  backgroundColor: '#F8FAFC',
}
```

### Code Styling

```ts
codeBlock: {
  backgroundColor: '#F6F8FA',
  borderColor: '#E1E4E8',
  borderRadius: 3,
  padding: 5,
  fontSizeScale: 0.9,
  showLanguageLabel: true,
  textColor: '#111827',
  labelColor: '#6B7280',
},
codespan: {
  backgroundColor: '#EEEEEE',
  padding: 0.8,
  showBackground: true,
  fontSizeScale: 0.88,
}
```

### Table Width Behavior

Tables follow the same content column as other block elements:
- left margin follows `page.xpading + indent`
- width is constrained to `page.maxContentWidth - indent`

Column alignment is read from the Markdown delimiter row and applied
automatically — see [Tables](/elements/tables).

## Scheduled Default Changes

Two options currently default to the behaviour of 4.1.x so that upgrading does
not move anything on an existing page. Their defaults are scheduled to change in
a future release. Setting them explicitly makes that upgrade a no-op.

| Option | Current default | Future default | Effect of the future value |
| --- | --- | --- | --- |
| `spacing.blankLines` | `'preserve'` | `'collapse'` | Blank lines stop adding vertical space, so `spacing.*` alone decides block gaps |
| `breaks` | `true` | `false` | A single newline renders as a space rather than a hard break, per CommonMark |

```ts
// Opt in to the future behaviour today
const options = {
  // ...other options
  spacing: { blankLines: 'collapse' },
  breaks: false,
}
```

## Render Result

`MdTextRender` resolves to a summary of the render.

```ts
const result = await MdTextRender(doc, markdown, options)

result.endY          // cursor position when rendering finished
result.startPage     // page the render began on
result.pageCount     // pages this render produced
result.warnings      // everything that could not be drawn
result.droppedNodes  // how much content that cost
result.violations    // security violations raised during the render
```

Each warning carries a machine-readable `code`, a `message`, the `context` it
happened in, and — where content was discarded — `droppedNodes`.

Failures were previously silent: an image that failed to load, an unsupported
element, or a subtree past the nesting limit produced a PDF that looked
successful and was not. Check `warnings` when a document must be complete.

### Warning delivery

```ts
{
  silent: true,                       // suppress the library's console output
  onWarning: (w) => logger.warn(w),   // fires as each warning is recorded
}
```

Warnings are collected on the result regardless. A listener that throws is
caught, so caller logging cannot take a render down.

`endCursorYHandler` still fires and agrees with `endY`. It is deprecated in
favour of the result.

## Component Overrides

Replace or decorate any block renderer.

```ts
{
  components: {
    heading: (ctx) => {
      ctx.doc.setFillColor('#1A365D')
      ctx.doc.rect(ctx.x, ctx.y, ctx.maxWidth, 10, 'F')
      ctx.next()   // then draw the heading normally
    },
  },
}
```

Overridable: `heading`, `paragraph`, `list`, `listItem`, `blockquote`, `code`,
`table`, `image`, `hr`.

| Context field | Meaning |
| --- | --- |
| `doc` | The jsPDF document |
| `element` | The parsed element being rendered |
| `indentLevel` / `indent` | Nesting level, and that level in document units |
| `x` / `y` | Left edge and current vertical position |
| `maxWidth` | Width available, already reduced by `indent` |
| `store` / `options` | Cursor and page state, and the resolved options |
| `next()` | Runs the built-in renderer. A no-op after the first call |
| `render(el, level?)` | Lays out an element through the normal pipeline |

An override that throws is reported as a `COMPONENT_OVERRIDE_FAILED` warning
and the built-in runs instead, so a mistake degrades to default output rather
than losing the block.

## Security Options (opt-in)

Security is disabled by default for backward compatibility.

```ts
security: {
  enabled: true,
  violationMode: 'skip', // 'skip' | 'throw' | 'placeholder'

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
  maxMarkdownLength: 500_000,
  maxImageCount: 200,
  maxImageSizeBytes: 10 * 1024 * 1024,
  maxNestedDepth: 20,        // structural containers, not AST levels
  renderTimeoutMs: 30_000,
  imageFetchTimeoutMs: 10_000, // per remote image request; 0 disables

  // Hooks
  validateUrl: async (url, type) => true,
  onSecurityViolation: (violation) => console.warn(violation),

  // Placeholders
  placeholderText: '[blocked]',
  placeholderImageText: '[blocked image]',
}
```

### Violation Mode Behavior

- `skip`: block unsafe item and continue rendering.
- `throw`: throw `SecurityViolationError` and abort render.
- `placeholder`: render safe placeholder text instead of blocked content where supported.

### Nesting Depth Semantics

`maxNestedDepth` counts **structural containers** — lists, list items,
blockquotes and tables. Inline wrappers such as emphasis or links do not count
towards it, so the value corresponds to Markdown nesting as an author would
count it.

When the limit is exceeded the nested content is dropped, a
`MAX_NESTED_DEPTH_EXCEEDED` violation is raised, and the number of dropped nodes
is reported as a warning so the omission is never silent.

### Remote Image Fetching

`imageFetchTimeoutMs` bounds each individual remote image request. It is separate
from `renderTimeoutMs`, which is only sampled at checkpoints between render
phases and therefore cannot interrupt a request to a host that never responds.

Redirects are followed manually rather than transparently: every hop is
re-validated against the same protocol, domain and SSRF rules as the original
URL, with the chain bounded to 5 hops. A host that is permitted cannot redirect
the fetch to one that is not.

### Domain Allowlist Semantics

- `allowedImageDomains: undefined` -> allow all domains.
- `allowedImageDomains: []` -> block all remote image domains.
- `allowedImageDomains: ['example.com']` -> allow `example.com` and subdomains.

### URL Classification Rules

Security URL validation treats URLs as:
- `explicitScheme` (for example `https://...`) -> full protocol/domain/IP checks.
- `protocolRelative` (for example `//host/path`) -> treated as external absolute URL and fully checked.
- `relativePath` (for example `/a`, `./a`, `../a`, `?q=1`, `#id`) -> allowed by default; custom `validateUrl` can still reject.

### Browser Runtime SSRF Note

In browser runtimes, DNS APIs are unavailable, so IP-level checks are best-effort only. The library warns when these checks cannot be fully enforced. For strict SSRF enforcement, route remote image fetching through a trusted server-side proxy.

## Full Type

See the generated type definition in source:
- `src/types/renderOption.ts`
- `src/types/security.ts`

## Related Pages

- [MdTextRender](/api/MdTextRender)
- [Links](/elements/links)
- [Images](/elements/images)
- [Security Guide](/guide/security)
