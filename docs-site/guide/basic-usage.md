---
title: Basic Usage
description: Core MdTextRender workflow with practical option patterns.
llm_summary: |
  Basic usage flow for MdTextRender with required options, optional styling,
  and an opt-in security example for untrusted markdown.
---

# Basic Usage

## Core Workflow

1. Create a `jsPDF` document.
2. Define `RenderOption`.
3. Call `await MdTextRender(doc, markdown, options)`.
4. Save or stream the PDF.

## Required Setup

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender, type RenderOption } from 'jspdf-md-renderer'

const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

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
  endCursorYHandler: (y) => {
    console.log('Rendered until Y =', y)
  },
}

await MdTextRender(doc, '# Project Report\n\nHello world.', options)
doc.save('report.pdf')
```

## Common Optional Sections

```ts
const options: RenderOption = {
  // ...required fields
  heading: { bold: true, h1: 24, h2: 20 },
  spacing: { afterParagraph: 4, betweenListItems: 1 },
  image: { defaultAlign: 'center' },
  codeBlock: { showLanguageLabel: true },
  footer: { showPageNumbers: true, align: 'right' },
}
```

## Untrusted Markdown (Recommended)

Enable security controls for user-supplied markdown:

```ts
const options: RenderOption = {
  // ...required fields
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

See [Security Guide](/guide/security) and [Options Reference](/api/options) for full details.

## Useful Callbacks

- `endCursorYHandler(y)`: capture final content Y to append custom content.
- `pageBreakHandler(doc)`: add page-level decorations whenever renderer creates a new page.

## Concurrency

Rendering is safe across concurrent documents because render state is isolated per call.
