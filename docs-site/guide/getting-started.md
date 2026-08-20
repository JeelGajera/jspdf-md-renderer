---
title: Getting Started
description: Get up and running with jspdf-md-renderer quickly.
llm_summary: |
  Quick start: install the library plus its peers, render markdown with the minimal
  margin-based configuration, read the render result, then follow links to page geometry,
  component overrides, options and the security guide.
---

# Getting Started

## Install

`jspdf`, `jspdf-autotable` and `marked` are peer dependencies — the renderer
draws into a `jsPDF` document you construct, so it uses the copy your project
already has.

```bash
npm install jspdf-md-renderer jspdf jspdf-autotable marked
```

## First Render

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender } from 'jspdf-md-renderer'

const markdown = `
# My First PDF

This PDF was generated from **Markdown**.
`

const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

await MdTextRender(doc, markdown, {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: { regular: { name: 'helvetica', style: 'normal' } },
})

doc.save('my-first-pdf.pdf')
```

That is a complete configuration. `font.regular` is the only value you must
supply; the content area is derived from the document's own page size, and
everything else has a default.

::: tip Upgrading from 4.2 or earlier
Earlier versions required `cursor`, `endCursorYHandler`, `font.bold`,
`font.light` and five separate page geometry fields. They all still work and
still take precedence, so nothing needs changing. See
[Page Geometry](/guide/page-geometry) for the mapping.
:::

## Check What Rendered

`MdTextRender` resolves to a summary of the render. An image that failed to
load or content dropped by a security limit shows up here rather than only in
the console:

```ts
const result = await MdTextRender(doc, markdown, options)

console.log(result.pageCount, 'page(s), ended at Y', result.endY)

if (result.warnings.length) {
  console.warn('rendered with warnings:', result.warnings)
}
```

See [Render Result](/guide/render-result).

## Next Steps

- [Basic Usage](/guide/basic-usage) — the full workflow and common options
- [Page Geometry](/guide/page-geometry) — margins, formats and orientation
- [Render Result](/guide/render-result) — warnings and what they mean
- [Component Overrides](/guide/component-overrides) — draw any block yourself
- [Options Reference](/api/options)
- [Security Guide](/guide/security)
- [Playground](/playground/)
