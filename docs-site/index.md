---
layout: home
title: jspdf-md-renderer
titleTemplate: Render Markdown to PDF with jsPDF
description: A jsPDF utility to render Markdown directly into formatted PDFs with custom designs.
llm_summary: |
  jspdf-md-renderer renders markdown into jsPDF documents with configurable styling,
  layout controls, and optional security enforcement for untrusted content.
hero:
  name: jspdf-md-renderer
  text: Markdown to PDF
  tagline: Generate formatted PDFs from Markdown in browser or Node.js.
  image:
    light: /logo.svg
    dark: /logo-dark.svg
    alt: jspdf-md-renderer
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Playground
      link: /playground/
    - theme: alt
      text: API Reference
      link: /api/options
features:
  - icon: /icons/ts.svg
    title: TypeScript Ready
    details: Full type definitions for options, parsed elements, and security controls.
  - icon: /icons/ts.svg
    title: Customizable Rendering
    details: Control fonts, spacing, headings, lists, tables, images, and page decorations.
  - icon: /icons/ts.svg
    title: Browser and Node.js
    details: Use with ESM/bundlers or UMD script tags in browser runtime.
  - icon: /icons/ts.svg
    title: Security Controls
    details: Optional URL/image policies, SSRF checks, limits, and violation modes.
  - icon: /icons/ts.svg
    title: Concurrency Safe
    details: Render multiple documents in parallel with isolated state.
---

## Quick Start

```bash
npm install jspdf-md-renderer
```

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender } from 'jspdf-md-renderer'

const doc = new jsPDF()

await MdTextRender(doc, '# Hello World\n\nRendered with **jspdf-md-renderer**!', {
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
  endCursorYHandler: (y) => console.log('Ended at Y:', y),
})

doc.save('output.pdf')
```

## Security Example (opt-in)

```ts
await MdTextRender(doc, markdown, {
  ...options,
  security: {
    enabled: true,
    violationMode: 'skip',
    allowedLinkProtocols: ['https:', 'mailto:'],
    allowedImageProtocols: ['https:'],
    blockLocalhost: true,
    blockPrivateIPs: true,
    maxMarkdownLength: 500_000,
  },
})
```
