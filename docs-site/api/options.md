---
title: Options Reference
description: Complete v4 RenderOption reference for jspdf-md-renderer.
llm_summary: |
  v4 RenderOption reference including heading scale, list/task options,
  codeBlock/codespan styling, spacing system, blockquote/list/paragraph controls,
  and page header/footer with page numbers.
---

# Options Reference

`RenderOption` controls typography, spacing, layout, colors, and page decorations.

## Minimal Required Shape

```ts
import type { RenderOption } from 'jspdf-md-renderer'

const options: RenderOption = {
  cursor: { x: 10, y: 10 },
  page: {
    format: 'a4',
    unit: 'mm',
    orientation: 'portrait',
    maxContentWidth: 190,
    maxContentHeight: 277,
    lineSpace: 3,
    defaultLineHeightFactor: 1.4,
    defaultFontSize: 11,
    defaultTitleFontSize: 14,
    topmargin: 10,
    xpading: 10,
    xmargin: 10,
    indent: 8,
  },
  font: {
    bold: { name: 'helvetica', style: 'bold' },
    regular: { name: 'helvetica', style: 'normal' },
    light: { name: 'helvetica', style: 'light' },
    italic: { name: 'helvetica', style: 'italic' },
    boldItalic: { name: 'helvetica', style: 'bolditalic' },
    code: { name: 'courier', style: 'normal' },
  },
  endCursorYHandler: () => {},
}
```

## New in v4

### Heading Typography

```ts
heading: {
  h1: 26, h2: 22, h3: 18, h4: 16, h5: 13, h6: 11,
  bottomSpacing: 3,
  color: '#1A365D',
  h1Color: '#7B2D00',
}
```

### Spacing System

```ts
spacing: {
  afterHeading: 2,
  afterParagraph: 4,
  afterCodeBlock: 4,
  afterBlockquote: 3,
  afterImage: 2,
  afterHR: 2,
  betweenListItems: 1,
  afterList: 3,
  afterTable: 3,
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

### Lists and Blockquotes

```ts
list: {
  bulletChar: '• ',
  indentSize: 8,
  itemSpacing: 0,
},
blockquote: {
  barColor: '#AAAAAA',
  barWidth: 1,
  paddingLeft: 4,
  backgroundColor: undefined,
}
```

### Header/Footer and Page Numbers

```ts
header: {
  text: 'My Company Report',
  align: 'center',
  color: '#1A365D',
  fontSize: 9,
},
footer: {
  showPageNumbers: true,
  align: 'right',
}
```

## Full Type (summary)

```ts
type RenderOption = {
  cursor: { x: number; y: number }
  page: {
    format?: string | number[]
    unit: 'pt' | 'mm' | 'cm' | 'in' | 'px' | 'pc' | 'em' | 'ex'
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
    italic?: { name: string; style: string }
    boldItalic?: { name: string; style: string }
    code?: { name: string; style: string }
  }
  heading?: { h1?: number; h2?: number; h3?: number; h4?: number; h5?: number; h6?: number; bottomSpacing?: number; color?: string; h1Color?: string; h2Color?: string; h3Color?: string; h4Color?: string; h5Color?: string; h6Color?: string }
  paragraph?: { bottomSpacing?: number; color?: string }
  list?: { bulletChar?: string; indentSize?: number; itemSpacing?: number }
  blockquote?: { barColor?: string; barWidth?: number; paddingLeft?: number; backgroundColor?: string; bottomSpacing?: number }
  spacing?: { afterHeading?: number; afterParagraph?: number; afterCodeBlock?: number; afterBlockquote?: number; afterImage?: number; afterHR?: number; betweenListItems?: number; afterList?: number; afterTable?: number }
  content?: { textAlignment: 'left' | 'right' | 'center' | 'justify' }
  codeBlock?: { backgroundColor?: string; borderColor?: string; borderRadius?: number; padding?: number; fontSizeScale?: number; showLanguageLabel?: boolean; textColor?: string; labelColor?: string }
  codespan?: { backgroundColor?: string; padding?: number; showBackground?: boolean; fontSizeScale?: number }
  link?: { linkColor: [number, number, number] }
  image?: { defaultAlign?: 'left' | 'center' | 'right' }
  table?: import('jspdf-autotable').UserOptions
  header?: { text?: string | ((pageNumber: number, totalPages: number) => string); y?: number; fontSize?: number; color?: string; align?: 'left' | 'center' | 'right' }
  footer?: { text?: string | ((pageNumber: number, totalPages: number) => string); y?: number; fontSize?: number; color?: string; align?: 'right' | 'left' | 'center'; showPageNumbers?: boolean }
  pageBreakHandler?: (doc: import('jspdf').default) => void
  endCursorYHandler: (y: number) => void
}
```

## Notes

- Validation errors are thrown only by option validation.
- Rendering-time non-fatal issues are logged with warnings.
- Very long unbroken tokens (for example long links or long inline code text) now wrap safely in v4.
