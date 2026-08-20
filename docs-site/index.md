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
  - icon: >-
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/></svg>
    title: TypeScript Ready
    details: Full type definitions for options, parsed elements, and security controls.
  - icon: >-
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/></svg>
    title: Customizable Rendering
    details: Control fonts, spacing, headings, lists, tables, images and page decorations — or replace any block renderer outright.
  - icon: >-
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
    title: Browser and Node.js
    details: Use with ESM/bundlers or UMD script tags in browser runtime.
  - icon: >-
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
    title: Security Controls
    details: Optional URL/image policies, SSRF checks, limits, and violation modes.
  - icon: >-
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>
    title: Concurrency Safe
    details: Render multiple documents in parallel with isolated state.
---

## Quick Start

```bash
npm install jspdf-md-renderer jspdf jspdf-autotable marked
```

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender } from 'jspdf-md-renderer'

const doc = new jsPDF({ unit: 'mm', format: 'a4' })

const result = await MdTextRender(
  doc,
  '# Hello World\n\nRendered with **jspdf-md-renderer**!',
  {
    page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
    font: { regular: { name: 'helvetica', style: 'normal' } },
  },
)

if (result.warnings.length) console.warn(result.warnings)
doc.save('output.pdf')
```

The content area is derived from the document's own page size, so the same
options work on any format. See [Page Geometry](/guide/page-geometry).

## Drawing a Block Yourself

```ts
await MdTextRender(doc, markdown, {
  ...options,
  components: {
    hr: (ctx) => {
      ctx.doc.setFillColor('#E2E8F0')
      ctx.doc.rect(ctx.x, ctx.y, ctx.maxWidth, 0.6, 'F')
      ctx.store.updateY(5, 'add')
    },
  },
})
```

See [Component Overrides](/guide/component-overrides).

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
