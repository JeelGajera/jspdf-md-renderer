---
title: Page Geometry
description: Configure the content area with page.margin instead of hand-computed width and height values.
llm_summary: |
  page.margin derives the content area from the document's own page size, replacing the deprecated
  maxContentWidth/maxContentHeight/topmargin/xpading/xmargin fields. Covers defaults, precedence,
  format and orientation independence, cursor interaction, and a migration mapping table.
---

# Page Geometry

Added in 4.3.

Every block the renderer draws is laid out inside a *content area*: a column of
a given width, starting at a given top edge, ending at a given bottom edge.
`page.margin` describes that area the way a word processor does — as margins
from the paper's edges — and the renderer derives the rest from the document
you passed in.

## The short version

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender } from 'jspdf-md-renderer'

const doc = new jsPDF({ unit: 'mm', format: 'a4' })

await MdTextRender(doc, markdown, {
  page: { margin: { top: 20, right: 20, bottom: 25, left: 20 } },
  font: { regular: { name: 'helvetica', style: 'normal' } },
})
```

That is a complete configuration. There is nothing else you are required to
supply.

## What gets derived

`page.margin` is resolved against `doc.internal.pageSize`, so the numbers always
match the document actually being drawn into:

| Derived value | From |
| --- | --- |
| `maxContentWidth` | `pageWidth - left - right` |
| `maxContentHeight` | `pageHeight - bottom` (an absolute Y, not a height) |
| `topmargin` | `top` |
| `xpading` | `left` |
| `xmargin` | `left` |

Any side you leave out defaults to `10`. `{ margin: {} }` is therefore a 10-unit
margin all round, and `{ margin: { top: 30 } }` changes only the top.

Margins are in the document's own unit. A document created with
`unit: 'pt'` takes point margins; `unit: 'in'` takes inches.

::: tip Negative margins
A negative margin would place content off the page, where it is simply not
visible. Negative values are clamped to `0`.
:::

## It follows the format and the orientation

Because the content area is computed from the document, the same options render
correctly on any paper size. Nothing needs recalculating when the format
changes:

```ts
const margin = { top: 15, right: 15, bottom: 15, left: 15 }
const options = { page: { margin }, font: { regular: { name: 'helvetica', style: 'normal' } } }

// 180 units wide on A4 portrait
await MdTextRender(new jsPDF({ unit: 'mm', format: 'a4' }), md, options)

// 249 units wide on Letter landscape — same options
await MdTextRender(
  new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' }),
  md,
  options,
)
```

## Where rendering starts

By default the cursor begins at the top-left of the content area — the origin
implied by your margins. Set `cursor` only when you want to start somewhere
else, for example below a letterhead you drew yourself:

```ts
{
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  cursor: { x: 20, y: 55 },   // start below a banner drawn before the render
}
```

Only the first line honours `cursor.x`; subsequent blocks return to the left
edge of the content column. After a page break, content resumes at
`margin.top`.

## Migrating from explicit geometry

The individual geometry fields still work, and they still **win** when both are
supplied. That makes a partial migration safe: add `page.margin`, then delete
the explicit fields one at a time and re-render.

| Deprecated field | Replacement |
| --- | --- |
| `page.maxContentWidth` | `margin.left` + `margin.right` |
| `page.maxContentHeight` | `margin.bottom` |
| `page.topmargin` | `margin.top` |
| `page.xpading` | `margin.left` |
| `page.xmargin` | `margin.left` |

Before:

```ts
page: {
  maxContentWidth: 190,
  maxContentHeight: 277,
  topmargin: 10,
  xpading: 10,
  xmargin: 10,
}
```

After — the same content area on A4 portrait in millimetres:

```ts
page: {
  margin: { top: 10, right: 10, bottom: 20, left: 10 },
}
```

(The derived numbers come from jsPDF's own page size, which is `210.0016` mm
wide rather than exactly `210`, so the content column is `190.0016` rather than
`190`. That is a sub-typographic-point difference and does not move text.)

::: warning maxContentHeight is not a height
Despite the name, `maxContentHeight` is the absolute Y coordinate of the bottom
of the content area. On a 297mm page, `maxContentHeight: 277` leaves a 20mm
bottom margin — which is why the migration above maps it to `bottom: 20` and
not `bottom: 277`. Getting this wrong is the single most common cause of
content running off the bottom of the page, and it is the reason `page.margin`
exists.
:::

## Headers and footers

`page.xmargin` positions page numbers and other header/footer decorations: a
left-aligned footer sits at `xmargin`, a right-aligned one at
`pageWidth - xmargin`. When you use `page.margin` it follows `margin.left`, so
with symmetric margins the footer lines up with the text column. Asymmetric
margins, or a footer you want outside the text column, need `xmargin` set
explicitly — it takes precedence:

```ts
page: {
  margin: { top: 20, right: 20, bottom: 25, left: 20 },
  xmargin: 12,   // footer sits closer to the paper edge than the text
},
footer: { showPageNumbers: true, align: 'right' },
```

## What is still yours to set

`page.margin` covers position and size only. These remain independent, because
they are typography rather than geometry:

```ts
page: {
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  defaultFontSize: 11,
  defaultTitleFontSize: 14,
  defaultLineHeightFactor: 1.4,
  lineSpace: 3,
  indent: 8,       // per level of list / blockquote nesting
}
```

## Related

- [Options Reference](/api/options#page-geometry)
- [Render Result](/guide/render-result) — see what a render could not fit
- [Basic Usage](/guide/basic-usage)
