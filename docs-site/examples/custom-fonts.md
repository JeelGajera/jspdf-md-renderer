---
title: Custom Fonts
description: Register a non-core font with registerFont and use it for headings, body text and code.
llm_summary: |
  registerFont(doc, { family, variants, fileNames?, onWarning? }) wires a base64 TTF into a jsPDF
  document and returns a font config that drops into RenderOption.font. Covers style-name matching,
  missing-variant fallback, a second family for code, loading font data in Node and the browser,
  file size, and the manual addFileToVFS/addFont equivalent.
---

# Custom Fonts

Use a custom font to match your brand, or to render a script the built-in
Helvetica does not cover.

## The problem `registerFont` solves

The renderer selects faces with `doc.setFont(family, style)`, using exactly the
style names `'normal'`, `'bold'`, `'italic'` and `'bolditalic'`. Wiring a font
in by hand means getting those names to line up — and when they do not, jsPDF
does not fail. It silently substitutes a core font in a *different family*, so
the only symptom is a PDF where some words are in the wrong typeface.

`registerFont` does the wiring and hands back a `font` config that matches.

## Register and use

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender, registerFont } from 'jspdf-md-renderer'
import { interRegular, interBold, interItalic } from './fonts'  // base64 strings

const doc = new jsPDF({ unit: 'mm', format: 'a4' })

const inter = registerFont(doc, {
  family: 'Inter',
  variants: {
    normal: interRegular,
    bold: interBold,
    italic: interItalic,
  },
})

await MdTextRender(doc, markdown, {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: inter.font,
})

doc.save('branded.pdf')
```

`inter.font` is exactly the shape `RenderOption.font` expects — `regular`,
`bold`, `italic` and `boldItalic`, each already pointing at the right family and
style.

::: warning Register before rendering
`registerFont` must be called on the same `doc` you render into, before
`MdTextRender`.
:::

## What it returns

```ts
interface RegisteredFont {
  family: string
  registered: Array<'normal' | 'bold' | 'italic' | 'bolditalic'>
  font: {
    regular:    { name: string; style: string }
    bold:       { name: string; style: string }
    italic:     { name: string; style: string }
    boldItalic: { name: string; style: string }
  }
}
```

`registered` lists the variants jsPDF actually accepted — which is not always
the ones you passed. A malformed face is reported by jsPDF through an internal
event rather than by throwing, so `registerFont` verifies each variant against
the document's font list afterwards and only reports what really landed.

## Missing variants

Only `normal` is required. Any style you do not supply falls back to the normal
face **within the same family**, so text stays in your typeface rather than
jumping to Helvetica:

```ts
const brand = registerFont(doc, {
  family: 'Inter',
  variants: { normal: interRegular },   // regular only
})

brand.font.bold   // → { name: 'Inter', style: 'normal' }
brand.registered  // → ['normal']
```

Bold and italic text will not be visually distinct, which is why a warning is
emitted listing exactly which styles are missing. Silence it with your own
handler once the trade-off is deliberate:

```ts
registerFont(doc, {
  family: 'Inter',
  variants: { normal: interRegular },
  onWarning: (message) => logger.debug(message),
})
```

## A separate family for code

Call it once per family and combine the results:

```ts
const body = registerFont(doc, {
  family: 'Inter',
  variants: { normal: interRegular, bold: interBold },
})
const mono = registerFont(doc, {
  family: 'FiraCode',
  variants: { normal: firaCodeRegular },
})

await MdTextRender(doc, markdown, {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: { ...body.font, code: mono.font.regular },
})
```

| Slot | Used for |
| --- | --- |
| `regular` | Body text, paragraphs, list items |
| `bold` | Headings and `**bold**` text |
| `italic` / `boldItalic` | `*italic*` and `***bold italic***` |
| `code` | Fenced code blocks and inline code spans |

## Getting the font data

`variants` takes base64-encoded font data. A `data:` URI prefix is accepted and
stripped, so both of these work:

```ts
variants: { normal: 'AAEAAAAOAIAAAwBgT1MvMg...' }
variants: { normal: 'data:font/ttf;base64,AAEAAAAOAIAAAwBgT1MvMg...' }
```

**Node.js**

```ts
import { readFileSync } from 'node:fs'

const interRegular = readFileSync('./fonts/Inter-Regular.ttf').toString('base64')
```

**Browser**

```ts
const res = await fetch('/fonts/Inter-Regular.ttf')
const buf = await res.arrayBuffer()
const interRegular = btoa(String.fromCharCode(...new Uint8Array(buf)))
```

**Build step** — most bundlers can inline a font as a base64 data URI, which
`registerFont` accepts as-is:

```ts
import interRegular from './fonts/Inter-Regular.ttf?inline'   // Vite
```

::: tip Keep an eye on file size
Every registered variant is embedded in the PDF in full — jsPDF does not subset
fonts. Four variants of a typical text face add roughly 400–800 KB to every
document. Register only the styles you actually use, and prefer a subsetted
font file if your documents use a small character set.
:::

### File names

Each variant is stored in jsPDF's virtual filesystem as
`<family>-<style>.ttf`. Override that if you need control over the names:

```ts
registerFont(doc, {
  family: 'Inter',
  variants: { normal: interRegular, bold: interBold },
  fileNames: { normal: 'Inter-Regular-v4.ttf' },
})
```

## Doing it by hand

`registerFont` is a convenience, not a requirement. The equivalent manual
wiring:

```ts
doc.addFileToVFS('Inter-normal.ttf', interRegular)
doc.addFont('Inter-normal.ttf', 'Inter', 'normal')
doc.addFileToVFS('Inter-bold.ttf', interBold)
doc.addFont('Inter-bold.ttf', 'Inter', 'bold')

await MdTextRender(doc, markdown, {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: {
    regular: { name: 'Inter', style: 'normal' },
    bold: { name: 'Inter', style: 'bold' },
    // 'italic' was never registered — pointing at it here is the mistake
    // registerFont exists to prevent.
    italic: { name: 'Inter', style: 'normal' },
    boldItalic: { name: 'Inter', style: 'bold' },
  },
})
```

Any format [jsPDF supports](https://artskydj.github.io/jsPDF/docs/module-addFont.html)
works — TTF is the common case.

## Related

- [Options Reference](/api/options#fonts)
- [Text Styles](/elements/text-styles)
- [Render Result](/guide/render-result)
