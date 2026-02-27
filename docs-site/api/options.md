---
title: Options Reference
description: Complete reference for all RenderOption fields in jspdf-md-renderer.
llm_summary: |
  Full options reference for RenderOption type. Required: cursor {x, y}, page (maxContentWidth,
  maxContentHeight, lineSpace, defaultLineHeightFactor, defaultFontSize, defaultTitleFontSize,
  topmargin, xpading, xmargin, indent), font (bold, regular, light as {name, style}),
  endCursorYHandler callback. Optional: page.format, page.unit, page.orientation, content.textAlignment,
  codespan (backgroundColor, padding, showBackground, fontSizeScale), link.linkColor, table (UserOptions
  passthrough), image.defaultAlign, pageBreakHandler.
---

# Options Reference

The `RenderOption` type controls every aspect of the markdown-to-PDF rendering. This page documents every field, its type, default value, and behavior.

## Quick Example

```ts
import type { RenderOption } from 'jspdf-md-renderer'

const options: RenderOption = {
  cursor: { x: 10, y: 10 },
  page: {
    format: 'a4',
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
  endCursorYHandler: (y) => console.log('End Y:', y),
}
```

## Cursor

Starting position for the render cursor.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cursor.x` | `number` | — *(required)* | X position where rendering starts (in page units) |
| `cursor.y` | `number` | — *(required)* | Y position where rendering starts (in page units) |

## Page

Controls page layout, spacing, and dimensions.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `page.format` | `string \| number[]` | `'a4'` | jsPDF page format (e.g., `'a4'`, `'letter'`, `[width, height]`) |
| `page.unit` | `string` | — | Unit system: `'mm'`, `'pt'`, `'px'`, `'in'` |
| `page.orientation` | `string` | `'p'` | Page orientation: `'p'` / `'portrait'` or `'l'` / `'landscape'` |
| `page.maxContentWidth` | `number` | `190` | Maximum width of the content area (in page units) |
| `page.maxContentHeight` | `number` | `277` | Maximum height before triggering a page break |
| `page.lineSpace` | `number` | `1.5` | Vertical spacing between rendered elements |
| `page.defaultLineHeightFactor` | `number` | `1.2` | Multiplier applied to font size for line height |
| `page.defaultFontSize` | `number` | `12` | Base font size for body text |
| `page.defaultTitleFontSize` | `number` | `14` | Font size used for heading elements |
| `page.topmargin` | `number` | `10` | Top margin applied when content continues on a new page |
| `page.xpading` | `number` | `10` | Horizontal padding inside the content area |
| `page.xmargin` | `number` | `10` | Left margin from the page edge |
| `page.indent` | `number` | `10` | Indentation size for nested lists (multiplied by nesting level) |

## Font

Font configuration for different text weights.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `font.bold.name` | `string` | `'helvetica'` | Font family name for bold text |
| `font.bold.style` | `string` | `'bold'` | Font style for bold text |
| `font.regular.name` | `string` | `'helvetica'` | Font family name for regular text |
| `font.regular.style` | `string` | `'normal'` | Font style for regular text |
| `font.light.name` | `string` | `'helvetica'` | Font family name for light text |
| `font.light.style` | `string` | `'light'` | Font style for light text |

::: tip Custom Fonts
To use custom fonts, first register them with jsPDF using `doc.addFont()`, then reference them in the font config:
```ts
doc.addFont('MyFont-Regular.ttf', 'MyFont', 'normal')
doc.addFont('MyFont-Bold.ttf', 'MyFont', 'bold')

const options = {
  font: {
    bold: { name: 'MyFont', style: 'bold' },
    regular: { name: 'MyFont', style: 'normal' },
    light: { name: 'MyFont', style: 'normal' },
  },
  // ...
}
```
:::

## Content <Badge type="info" text="optional" />

Text layout options.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `content.textAlignment` | `string` | — | Text alignment: `'left'`, `'right'`, `'center'`, or `'justify'` |

## Codespan <Badge type="info" text="optional" />

Styling for inline code (`` `code` ``) elements.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `codespan.backgroundColor` | `string` | `'#EEEEEE'` | Background color for inline code |
| `codespan.padding` | `number` | `0.5` | Padding around inline code text (in page units) |
| `codespan.showBackground` | `boolean` | `true` | Whether to draw the background rectangle |
| `codespan.fontSizeScale` | `number` | `0.9` | Scale factor applied to font size for code text |

## Link <Badge type="info" text="optional" />

Link rendering options.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `link.linkColor` | `[number, number, number]` | — | RGB color tuple for link text (e.g., `[0, 0, 255]`) |

## Table <Badge type="info" text="optional" />

Options passed directly to [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable). See the autotable docs for all available options.

```ts
{
  table: {
    theme: 'grid',           // 'striped' | 'grid' | 'plain'
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 10 },
    margin: { left: 10, right: 10 },
  }
}
```

## Image <Badge type="info" text="optional" />

Default image rendering options.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `image.defaultAlign` | `string` | `'left'` | Default alignment for images: `'left'`, `'center'`, or `'right'` |

::: info Per-Image Overrides
Individual images can override the default alignment using the attribute syntax:
```markdown
![photo](url){width=200 align=center}
```
See [Images](/elements/images) for full details.
:::

## Callbacks

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `endCursorYHandler` | `(y: number) => void` | — *(required)* | Called after rendering completes with the final Y cursor position |
| `pageBreakHandler` | `(doc: jsPDF) => void` | — | Called each time a new page is added during rendering |

### `endCursorYHandler`

This callback is **required**. It provides the Y position where rendering ended, enabling you to append more content below the markdown:

```ts
let endY = 0
await MdTextRender(doc, md, {
  ...options,
  endCursorYHandler: (y) => { endY = y },
})
doc.text('Footer text', 10, endY + 10)
```

### `pageBreakHandler`

Optional callback fired when a page break occurs. Use it to add headers, footers, or watermarks to new pages:

```ts
await MdTextRender(doc, md, {
  ...options,
  pageBreakHandler: (doc) => {
    doc.setFontSize(8)
    doc.text('Page Header', 10, 5)
  },
})
```

## TypeScript Type Definition

For reference, here is the complete `RenderOption` type:

```ts
type RenderOption = {
  cursor: { x: number; y: number }
  page: {
    format?: string | number[]
    unit?: 'mm' | 'pt' | 'px' | 'in'
    orientation?: 'portrait' | 'p' | 'landscape' | 'l'
    maxContentWidth: number
    maxContentHeight: number
    lineSpace: number
    defaultLineHeightFactor: number
    defaultFontSize: number
    defaultTitleFontSize: number
    topmargin: number
    xpading: number
    xmargin: number
    indent: number
  }
  font: {
    bold: { name: string; style: string }
    regular: { name: string; style: string }
    light: { name: string; style: string }
  }
  content?: { textAlignment: 'left' | 'right' | 'center' | 'justify' }
  codespan?: {
    backgroundColor?: string
    padding?: number
    showBackground?: boolean
    fontSizeScale?: number
  }
  link?: { linkColor: [number, number, number] }
  table?: UserOptions  // from jspdf-autotable
  image?: { defaultAlign?: 'left' | 'center' | 'right' }
  pageBreakHandler?: (doc: jsPDF) => void
  endCursorYHandler: (y: number) => void
}
```
