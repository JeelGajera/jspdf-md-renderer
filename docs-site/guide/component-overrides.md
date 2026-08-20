---
title: Component Overrides
description: Replace or decorate any block renderer with your own drawing code.
llm_summary: |
  components lets a caller replace or decorate the nine block renderers (heading, paragraph, list,
  listItem, blockquote, code, table, image, hr). Covers the ComponentContext fields, next() and
  render() semantics, worked recipes, the synchronous-only rule, cursor advancement, page breaks,
  and the COMPONENT_OVERRIDE_FAILED fallback.
---

# Component Overrides

Added in 4.3.

No set of options covers every design. `components` hands you the drawing
context for a block and lets you draw it yourself — a heading with a rule under
it, a callout instead of a quote bar, a code block in your own chrome — without
waiting for the library to grow an option for it.

```ts
await MdTextRender(doc, markdown, {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: { regular: { name: 'helvetica', style: 'normal' } },
  components: {
    hr: (ctx) => {
      ctx.doc.setDrawColor('#CBD5E1')
      ctx.doc.setLineDashPattern([1, 1], 0)
      ctx.doc.line(ctx.x, ctx.y, ctx.x + ctx.maxWidth, ctx.y)
      ctx.doc.setLineDashPattern([], 0)
      ctx.store.updateY(6, 'add')
    },
  },
})
```

## What can be overridden

| Component | Markdown it renders |
| --- | --- |
| `heading` | `#` through `######` |
| `paragraph` | A block of text |
| `list` | An ordered or unordered list as a whole |
| `listItem` | A single item within a list |
| `blockquote` | `> quoted` |
| `code` | A fenced code block |
| `table` | A GFM pipe table |
| `image` | A block-level image |
| `hr` | `---`, `***`, `___` |

Inline content — bold, italic, links, code spans — is not overridable. It is
laid out as part of the block that contains it.

## The context

Every override receives one object:

```ts
components: {
  heading: (ctx) => { /* ctx is a ComponentContext */ },
}
```

| Field | Type | What it is |
| --- | --- | --- |
| `ctx.doc` | `jsPDF` | The document being drawn into |
| `ctx.element` | `ParsedElement` | The block: `type`, `content`, `items`, and element-specific fields |
| `ctx.indentLevel` | `number` | Nesting level — 0 at the top, higher inside lists and blockquotes |
| `ctx.indent` | `number` | `indentLevel * page.indent`, in document units |
| `ctx.x` | `number` | Left edge for this block's content, already indented |
| `ctx.y` | `number` | Current vertical position |
| `ctx.maxWidth` | `number` | Width available, already reduced by `indent` |
| `ctx.store` | `RenderStore` | Cursor and page state — see [Advancing the cursor](#advancing-the-cursor) |
| `ctx.options` | `ResolvedRenderOption` | The fully resolved options, with every default filled in |
| `ctx.next()` | `() => void` | Runs the built-in renderer for this block |
| `ctx.render(el, level?)` | `(ParsedElement, number?) => void` | Lays out any element through the normal pipeline |

`ctx.x`, `ctx.y`, `ctx.indent` and `ctx.maxWidth` are derived for you. Drawing
between `ctx.x` and `ctx.x + ctx.maxWidth` keeps a block inside the content
column at any nesting level.

## Decorating vs replacing

**Replace** — draw the block yourself and do not call `next()`:

```ts
components: {
  hr: (ctx) => {
    ctx.doc.setFillColor('#E2E8F0')
    ctx.doc.rect(ctx.x, ctx.y, ctx.maxWidth, 0.6, 'F')
    ctx.store.updateY(5, 'add')
  },
}
```

**Decorate** — draw around the built-in and call `next()` for the content
itself:

```ts
components: {
  heading: (ctx) => {
    if (ctx.element.depth === 1) {
      ctx.doc.setFillColor('#F1F5F9')
      ctx.doc.rect(ctx.x - 2, ctx.y - 1, ctx.maxWidth + 4, 12, 'F')
    }
    ctx.next()
  },
}
```

`next()` is a no-op after the first call, so a decorator cannot accidentally
draw the same block twice — including on a path where it is called in more than
one branch.

An override that never calls `next()` and draws nothing produces an empty gap.
That is a legitimate way to suppress a block:

```ts
components: {
  image: () => {},   // text-only export: skip every image
}
```

## Advancing the cursor

The renderer does not know how tall your drawing is. If an override does not
move the cursor, the next block draws on top of it.

```ts
ctx.store.updateY(8, 'add')   // move down 8 units
ctx.store.updateY(120)        // or set an absolute Y
```

`ctx.store.Y` reads the current position, so a common shape is: capture
`ctx.y`, draw, then advance by however much you used.

```ts
components: {
  blockquote: (ctx) => {
    const top = ctx.y
    for (const child of ctx.element.items ?? []) {
      ctx.render(child, ctx.indentLevel)
    }
    // Children advanced the cursor themselves; draw the accent afterwards,
    // now that the height is known.
    ctx.doc.setFillColor('#0EA5E9')
    ctx.doc.rect(ctx.x - 4, top, 1.2, ctx.store.Y - top, 'F')
    ctx.store.updateY(3, 'add')
  },
}
```

::: warning Page breaks are yours to handle
The built-in renderers break the page when a block does not fit. An override
that draws its own content should check the remaining space:

```ts
components: {
  code: (ctx) => {
    const height = 24
    if (ctx.y + height > ctx.options.page.maxContentHeight) {
      ctx.doc.addPage()
      ctx.store.updateY(ctx.options.page.topmargin)
    }
    // ...draw
  },
}
```

Remember that `page.maxContentHeight` is the absolute Y of the content bottom,
not a height — see [Page Geometry](/guide/page-geometry).
:::

## Rendering children

`ctx.render(element, indentLevel?)` puts an element back through the normal
pipeline, overrides included. Use it for the children of a container:

```ts
components: {
  listItem: (ctx) => {
    ctx.doc.setFillColor('#10B981')
    ctx.doc.circle(ctx.x - 3, ctx.y + 1.5, 1, 'F')   // custom bullet
    for (const child of ctx.element.items ?? []) {
      ctx.render(child, ctx.indentLevel)
    }
  },
}
```

Because `render` goes through the pipeline, a `paragraph` override also applies
to paragraphs rendered this way. That is usually what you want — the alternative
is two code paths that drift apart.

## Recipes

### A rule under every `h2`

```ts
components: {
  heading: (ctx) => {
    ctx.next()
    if (ctx.element.depth === 2) {
      const y = ctx.store.Y - 1
      ctx.doc.setDrawColor('#E2E8F0')
      ctx.doc.line(ctx.x, y, ctx.x + ctx.maxWidth, y)
      ctx.store.updateY(2, 'add')
    }
  },
}
```

### Blockquotes as coloured callouts

```ts
const CALLOUTS: Record<string, string> = {
  '[!NOTE]': '#3B82F6',
  '[!WARNING]': '#F59E0B',
}

components: {
  blockquote: (ctx) => {
    const first = ctx.element.items?.[0]
    const marker = Object.keys(CALLOUTS).find((k) =>
      first?.content?.startsWith(k),
    )
    if (!marker) return ctx.next()

    ctx.doc.setFillColor(CALLOUTS[marker])
    ctx.doc.rect(ctx.x, ctx.y, 2, 10, 'F')
    ctx.next()
  },
}
```

### A watermark behind every table

```ts
components: {
  table: (ctx) => {
    ctx.doc.setTextColor('#F1F5F9')
    ctx.doc.setFontSize(28)
    ctx.doc.text('DRAFT', ctx.x + ctx.maxWidth / 2, ctx.y + 20, {
      align: 'center',
      angle: 20,
    })
    ctx.doc.setTextColor('#000000')
    ctx.next()
  },
}
```

Content in a PDF paints in the order it is drawn, so anything you want *behind*
the block must be drawn before `next()`, and anything on top after it.

## Rules and failure behaviour

**Overrides must be synchronous.** Rendering is synchronous, so anything an
override does after an `await` runs once the document is already finished and
never appears in the output. Returning a promise is reported as a
`COMPONENT_OVERRIDE_FAILED` warning rather than silently losing the drawing. Do
asynchronous work — fetching a logo, loading a font — before calling
`MdTextRender`.

**A throwing override falls back.** The failure is reported as a
`COMPONENT_OVERRIDE_FAILED` warning and the built-in renderer runs instead,
unless the override had already called `next()`. A mistake in your code degrades
to default output rather than losing the block or failing the render:

```ts
const result = await MdTextRender(doc, markdown, { ...options, silent: true })

for (const w of result.warnings) {
  if (w.code === 'COMPONENT_OVERRIDE_FAILED') {
    console.error(`override for '${w.context}' failed: ${w.message}`)
  }
}
```

See [Render Result](/guide/render-result) for the full warning contract.

**Passing overrides changes nothing on its own.** `components: {}`, and any
override that only calls `ctx.next()`, produce byte-identical output to no
overrides at all. Adding a hook is not a decision to opt into different
defaults.

## Types

```ts
import type {
  ComponentName,
  ComponentContext,
  ComponentRenderer,
  ComponentOverrides,
} from 'jspdf-md-renderer'

const heading: ComponentRenderer = (ctx: ComponentContext) => ctx.next()

const components: ComponentOverrides = { heading }
```

## Related

- [Options Reference](/api/options#component-overrides)
- [Render Result](/guide/render-result)
- [Page Geometry](/guide/page-geometry)
