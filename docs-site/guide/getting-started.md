---
title: Getting Started
description: Get up and running with jspdf-md-renderer quickly.
llm_summary: |
  Quick start for installing and rendering markdown to a PDF with minimal required options,
  plus links to advanced options and security guide.
---

# Getting Started

## Install

```bash
npm install jspdf-md-renderer
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
    bold: { name: 'helvetica', style: 'bold' },
    regular: { name: 'helvetica', style: 'normal' },
    light: { name: 'helvetica', style: 'light' },
  },
  endCursorYHandler: (y) => {
    console.log('Final Y:', y)
  },
})

doc.save('my-first-pdf.pdf')
```

## Next Steps

- [Basic Usage](/guide/basic-usage)
- [Options Reference](/api/options)
- [Security Guide](/guide/security)
- [Playground](/playground/)
