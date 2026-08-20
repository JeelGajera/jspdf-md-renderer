---
title: Basic Usage
description: Core MdTextRender workflow with practical option patterns.
llm_summary: |
  Basic usage flow for MdTextRender: minimal margin-based options, common optional sections,
  reading the render result, component overrides, an opt-in security example for untrusted
  markdown, callbacks and concurrency.
---

# Basic Usage

## Core Workflow

1. Create a `jsPDF` document.
2. Define `RenderOption`.
3. `const result = await MdTextRender(doc, markdown, options)`.
4. Check `result.warnings`, then save or stream the PDF.

## Minimal Setup

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender, type RenderOption } from 'jspdf-md-renderer'

const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

const options: RenderOption = {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: { regular: { name: 'helvetica', style: 'normal' } },
}

const result = await MdTextRender(doc, '# Project Report\n\nHello world.', options)
doc.save('report.pdf')
```

`font.regular` is the only required value. Margins are optional too — each side
defaults to `10`. See [Page Geometry](/guide/page-geometry) for how the content
area is derived, and for migrating from the explicit `maxContentWidth` /
`maxContentHeight` fields.

## Common Optional Sections

```ts
const options: RenderOption = {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: {
    regular: { name: 'helvetica', style: 'normal' },
    bold: { name: 'helvetica', style: 'bold' },
    code: { name: 'courier', style: 'normal' },
  },
  heading: { bold: true, h1: 24, h2: 20 },
  spacing: { afterParagraph: 4, betweenListItems: 1 },
  image: { defaultAlign: 'center' },
  codeBlock: { showLanguageLabel: true },
  footer: { showPageNumbers: true, align: 'right' },
}
```

## Reading the Result

```ts
const result = await MdTextRender(doc, markdown, options)

result.endY        // where the content ended, for appending your own drawing
result.pageCount   // pages this render produced
result.warnings    // anything that could not be drawn
```

An empty `warnings` array means the document is complete. For a document that
must not silently lose content, check it before saving:

```ts
if (result.droppedNodes > 0) {
  throw new Error('Refusing to issue an incomplete document')
}
```

See [Render Result](/guide/render-result) for the full warning contract, and for
`silent` and `onWarning`.

## Drawing a Block Yourself

Any block renderer can be replaced or decorated:

```ts
const options: RenderOption = {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: { regular: { name: 'helvetica', style: 'normal' } },
  components: {
    hr: (ctx) => {
      ctx.doc.setFillColor('#E2E8F0')
      ctx.doc.rect(ctx.x, ctx.y, ctx.maxWidth, 0.6, 'F')
      ctx.store.updateY(5, 'add')
    },
  },
}
```

See [Component Overrides](/guide/component-overrides).

## Untrusted Markdown (Recommended)

Enable security controls for user-supplied markdown:

```ts
const options: RenderOption = {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: { regular: { name: 'helvetica', style: 'normal' } },
  security: {
    enabled: true,
    violationMode: 'skip',
    allowedLinkProtocols: ['https:', 'mailto:'],
    allowedImageProtocols: ['https:'],
    blockLocalhost: true,
    blockPrivateIPs: true,
    maxMarkdownLength: 500_000,
    maxImageCount: 200,
    maxNestedDepth: 20,
  },
}
```

Blocked content is reported on `result.violations`, and content dropped by a
limit is reported on `result.warnings`, so nothing is removed silently.

See [Security Guide](/guide/security) and [Options Reference](/api/options) for
full details.

## Callbacks

- `onWarning(warning)`: fires for each thing the render could not draw.
- `pageBreakHandler(doc)`: add page-level decorations whenever the renderer
  creates a new page.
- `endCursorYHandler(y)`: capture the final content Y. **Deprecated** — use
  `result.endY`, which carries the same value.

## Concurrency

Rendering is safe across concurrent documents because render state is isolated
per call.
