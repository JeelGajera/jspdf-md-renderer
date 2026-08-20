---
title: Render Result
description: Read what a render produced and what it could not draw, using the returned result and warnings.
llm_summary: |
  MdTextRender resolves to { endY, startPage, pageCount, warnings, droppedNodes, violations }.
  Covers the warning shape, the full RenderWarningCode table, silent and onWarning delivery,
  strict-mode and logging patterns, and migration from endCursorYHandler.
---

# Render Result

Added in 4.3.

`MdTextRender` used to resolve to `undefined`, which meant a render that quietly
dropped an image, an unsupported element, or a subtree past the nesting limit
produced a PDF that looked successful and was not. It now resolves to a summary
of what happened.

```ts
const result = await MdTextRender(doc, markdown, options)
```

## The result object

```ts
interface RenderResult {
  endY: number              // cursor Y when rendering finished
  startPage: number         // page the render began on
  pageCount: number         // pages this render produced, including the first
  warnings: RenderWarning[] // everything that could not be drawn
  droppedNodes: number      // total nodes discarded, summed across warnings
  violations: SecurityViolation[]
}
```

`startPage` and `pageCount` matter when you render into a document that already
has content — they describe *this* render, not the document as a whole.

### Continuing after a render

```ts
const result = await MdTextRender(doc, markdown, options)

doc.setFontSize(9)
doc.text('Generated ' + new Date().toISOString(), 20, result.endY + 8)

console.log(`rendered ${result.pageCount} page(s) from page ${result.startPage}`)
```

## Warnings

```ts
interface RenderWarning {
  code: RenderWarningCode
  message: string
  context?: string       // an element type, a URL, a font family
  droppedNodes?: number  // present when content was discarded
}
```

A warning means the render continued but the output is not what the Markdown
described. An empty `warnings` array means the document is complete.

### Warning codes

| Code | What happened |
| --- | --- |
| `TOKEN_CONVERSION_FAILED` | A token could not be converted to a renderable element; that block was skipped |
| `UNSUPPORTED_ELEMENT` | A parsed element type has no renderer |
| `IMAGE_LOAD_FAILED` | An image could not be fetched or decoded |
| `IMAGE_RENDER_FAILED` | The image loaded but jsPDF refused to draw it |
| `IMAGE_ATTRS_IGNORED` | An image's `{width=… height=… align=…}` block was too long to parse, so the image drew at its natural size |
| `IMAGE_SIZE_UNKNOWN` | An image's intrinsic size could not be read, so a fallback size was used |
| `TABLE_SKIPPED` | A table could not be rendered by `jspdf-autotable` |
| `TABLE_CALLBACK_FAILED` | A user `table` callback threw |
| `TABLE_POSITION_UNKNOWN` | The cursor could not be advanced past a table exactly |
| `CODE_BLOCK_OVERFLOW` | A code line is wider than the content column and was clipped |
| `CONTENT_DROPPED` | A subtree was discarded — most often the security nesting limit |
| `COMPONENT_OVERRIDE_FAILED` | A [component override](/guide/component-overrides) threw or was async |
| `SECURITY_CALLBACK_FAILED` | A `validateUrl` or `onSecurityViolation` callback threw |
| `SSRF_CHECKS_UNAVAILABLE` | IP-level checks could not run because DNS resolution is unavailable (browser runtime) |

Codes are stable API. New codes may be added in a minor release, so treat an
unrecognised code as a generic warning rather than an error.

## Delivery

Warnings are always collected on the result. Two options control everything
else:

```ts
await MdTextRender(doc, markdown, {
  ...options,
  silent: true,                      // no console output from the library
  onWarning: (w) => logger.warn(w),  // fires as each warning is recorded
})
```

- **`silent`** — the library logs each warning with `console.warn` by default,
  which is useful during development and noise in production. `silent: true`
  turns that off without hiding anything: `result.warnings` is unaffected.
- **`onWarning`** — receives each warning as it happens, which is what you want
  for streaming to a logger or for attributing a warning to the point in a long
  document where it occurred. A listener that throws is caught, so your logging
  can never take a render down.

## Patterns

### Fail when a document must be complete

An invoice or a contract that silently lost a clause is worse than one that
failed to generate:

```ts
const result = await MdTextRender(doc, markdown, { ...options, silent: true })

if (result.droppedNodes > 0) {
  throw new Error(
    `Refusing to issue an incomplete document: ${result.droppedNodes} node(s) dropped — ` +
      result.warnings.map((w) => `${w.code}: ${w.message}`).join('; '),
  )
}

doc.save('invoice.pdf')
```

`droppedNodes` is the right check here: it counts lost *content*, whereas
`warnings.length` also includes cosmetic issues such as a missing font variant.

### Degrade instead of failing

```ts
const result = await MdTextRender(doc, markdown, { ...options, silent: true })

const brokenImages = result.warnings.filter((w) => w.code === 'IMAGE_LOAD_FAILED')
if (brokenImages.length) {
  // w.context is the URL that failed
  report.missingAssets = brokenImages.map((w) => w.context)
}
```

### Surface warnings in a build

```ts
if (result.warnings.length) {
  for (const w of result.warnings) {
    console.error(`::warning::${w.code} ${w.message}`)
  }
  process.exitCode = 1
}
```

### Security violations

`violations` is populated when [security](/guide/security) is enabled and
`violationMode` is `'skip'` or `'placeholder'` — the modes that keep rendering.
With `'throw'` the render rejects instead, so there is no result to inspect.

```ts
const result = await MdTextRender(doc, untrusted, {
  ...options,
  security: { enabled: true, violationMode: 'skip' },
})

for (const v of result.violations) {
  audit.record(v.code, v.url)
}
```

## Migrating from `endCursorYHandler`

`endCursorYHandler` still fires and still receives the same value as
`result.endY`. It is deprecated because a callback can only report one number,
while the result carries everything.

```ts
// Before
let endY = 0
await MdTextRender(doc, md, { ...options, endCursorYHandler: (y) => { endY = y } })

// After
const { endY } = await MdTextRender(doc, md, options)
```

## Related

- [Options Reference](/api/options#render-result)
- [Security Guide](/guide/security)
- [Component Overrides](/guide/component-overrides)
