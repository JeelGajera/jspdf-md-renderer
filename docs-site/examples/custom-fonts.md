---
title: Custom Fonts
description: How to use custom fonts with jspdf-md-renderer.
llm_summary: |
  Demonstrates custom font registration with jsPDF's addFont method,
  then referencing fonts in the font option of RenderOption. Supports
  any TTF font that jsPDF can load.
---

# Custom Fonts Example

Use custom fonts to match your brand or design requirements.

## How It Works

1. **Add the font to jsPDF** using `doc.addFont()`
2. **Reference it** in the `font` options

## Step-by-Step

### 1. Prepare Your Font File

You need the font in TTF, OTF, or another format [supported by jsPDF](https://artskydj.github.io/jsPDF/docs/module-addFont.html). Convert it to a base64 string or load it as a binary.

### 2. Register the Font

```ts
import { jsPDF } from 'jspdf'

const doc = new jsPDF({ unit: 'mm', format: 'a4' })

// Add fonts (you need the font file data)
// Method 1: If your font file is base64 encoded
doc.addFileToVFS('Roboto-Regular.ttf', robotoRegularBase64)
doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')

doc.addFileToVFS('Roboto-Bold.ttf', robotoBoldBase64)
doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')

doc.addFileToVFS('Roboto-Italic.ttf', robotoItalicBase64)
doc.addFont('Roboto-Italic.ttf', 'Roboto', 'italic')

doc.addFileToVFS('FiraCode-Regular.ttf', firaCodeBase64)
doc.addFont('FiraCode-Regular.ttf', 'FiraCode', 'normal')
```

### 3. Use in Options

```ts
import { MdTextRender } from 'jspdf-md-renderer'

const options = {
  cursor: { x: 10, y: 10 },
  page: {
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
    bold: { name: 'Roboto', style: 'bold' },
    regular: { name: 'Roboto', style: 'normal' },
    light: { name: 'Roboto', style: 'normal' }, // Use regular if no light variant
    code: { name: 'FiraCode', style: 'normal' },
  },
  endCursorYHandler: (y) => console.log('End Y:', y),
}

await MdTextRender(doc, markdownContent, options)
doc.save('custom-font-document.pdf')
```

## Complete Example

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender } from 'jspdf-md-renderer'
// Import your font data (base64 encoded TTF)
import { robotoRegular, robotoBold, firaCode } from './fonts'

async function generateWithCustomFonts() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  // Register fonts
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', robotoBold)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.addFileToVFS('FiraCode-Regular.ttf', firaCode)
  doc.addFont('FiraCode-Regular.ttf', 'FiraCode', 'normal')

  const markdown = `
# Custom Font Demo

This document uses **Roboto** instead of the default Helvetica.

## Why Custom Fonts?

- Match your brand identity
- Better readability for specific languages
- Professional document appearance

> Custom fonts make your PDFs stand out.
`

  await MdTextRender(doc, markdown, {
    cursor: { x: 10, y: 10 },
    page: {
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
      bold: { name: 'Roboto', style: 'bold' },
      regular: { name: 'Roboto', style: 'normal' },
      light: { name: 'Roboto', style: 'normal' },
      code: { name: 'FiraCode', style: 'normal' },
    },
    endCursorYHandler: () => {},
  })

  doc.save('custom-fonts.pdf')
}
```

::: tip Font Weight Mapping
The `font` option maps to specific usage targets:
- **`bold`** — used for headings, `**bold**` text, and list markers
- **`regular`** — used for body text, paragraphs, and list items
- **`light`** — used for lighter text elements (falls back to regular if not available)
- **`code`** — used for fenced code blocks and inline codespans
:::

::: warning Font Availability
Make sure to register the font *before* calling `MdTextRender`. If a referenced font name doesn't exist in jsPDF, it will fall back to the default Helvetica.
:::
