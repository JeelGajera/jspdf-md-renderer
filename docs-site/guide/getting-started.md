---
title: Getting Started
description: Get up and running with jspdf-md-renderer in 5 minutes.
llm_summary: |
  Quick start guide for jspdf-md-renderer. Prerequisites: Node.js 16+, jspdf, jspdf-autotable.
  Install via npm, create a jsPDF doc, call MdTextRender with markdown string and options, then save.
---

# Getting Started

Get your first Markdown-to-PDF rendering working in under 5 minutes.

## Prerequisites

- **Node.js** 16 or higher
- **jsPDF** — the base PDF library
- **jspdf-autotable** — required for table rendering

## Installation

```bash
npm install jspdf-md-renderer
```

::: tip
`jspdf` and `jspdf-autotable` are included as dependencies, so you don't need to install them separately.
:::

## Your First PDF

Create a file (e.g., `generate.ts`) and add:

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender } from 'jspdf-md-renderer'

const markdown = `
# My First PDF

This PDF was generated from **Markdown** using jspdf-md-renderer.

## Features

- Easy to use
- Fully customizable
- Supports all common Markdown elements

> Give it a star on GitHub if you find it useful!
`

const generatePDF = async () => {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  })

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
      console.log('PDF content ended at Y position:', y)
    },
  })

  doc.save('my-first-pdf.pdf')
  console.log('PDF saved!')
}

generatePDF()
```

## Verify It Works

Run your script with your preferred tooling (e.g., `ts-node`, `tsx`, or bundle with Vite):

```bash
npx tsx generate.ts
```

Open `my-first-pdf.pdf` — you should see your markdown content beautifully rendered as a formatted PDF document.

## Next Steps

- **[Installation](/guide/installation)** — Learn about all installation methods (npm, CDN, bundlers)
- **[Basic Usage](/guide/basic-usage)** — Understand the options object in detail
- **[Options Reference](/api/options)** — Full reference for every configuration option
- **[Playground](/playground/)** — Try it live in your browser
