---
layout: home
title: jspdf-md-renderer
titleTemplate: Render Markdown to PDF with jsPDF
description: A jsPDF utility to render Markdown directly into formatted PDFs with custom designs.
llm_summary: |
  jspdf-md-renderer is an npm package that renders Markdown content directly into jsPDF PDF documents.
  It supports headings, paragraphs, lists, tables, images, code blocks, blockquotes, links, horizontal rules,
  and inline styles (bold, italic, code). All render options are fully customizable.
hero:
  name: jspdf-md-renderer
  text: Markdown ⇢ PDF
  tagline: Generate beautifully formatted PDFs directly from Markdown. Zero config, works in browser and Node.js.
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
  - icon: 🚀
    title: Zero Config
    details: Sensible defaults out of the box — just pass markdown and get a beautifully formatted PDF. No setup required.
  - icon: 🎨
    title: Fully Customizable
    details: Fine-tune every aspect — fonts, margins, spacing, colors, image alignment, table styles, and more via the options API.
  - icon: 🌐
    title: Browser + Node.js
    details: Works closely with Vite, Webpack, ESM imports, or directly via UMD script tags and CDN.
  - icon: 📝
    title: Rich Support
    details: Headings, lists, tables, images, code blocks, blockquotes, links, and inline styles.
  - icon: 📄
    title: Auto Page Breaks
    details: Content that overflows the page is automatically continued on a new page with proper cursor tracking.
  - icon: 🔗
    title: Built on jsPDF
    details: Integrates seamlessly with existing jsPDF workflows and plugins like jspdf-autotable.
---

<div style="display: flex; justify-content: center; gap: 12px; margin-top: 3rem; margin-bottom: 2rem; flex-wrap: wrap;">
  <a href="https://www.npmjs.com/package/jspdf-md-renderer">
    <img src="https://img.shields.io/npm/v/jspdf-md-renderer.svg?style=for-the-badge&color=333" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/jspdf-md-renderer">
    <img src="https://img.shields.io/npm/dm/jspdf-md-renderer.svg?style=for-the-badge&color=555" alt="Downloads" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-777.svg?style=for-the-badge" alt="License: MIT" />
  </a>
  <a href="https://github.com/JeelGajera/jspdf-md-renderer">
    <img src="https://img.shields.io/github/stars/JeelGajera/jspdf-md-renderer?style=for-the-badge&color=222" alt="GitHub Stars" />
  </a>
</div>

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
  page: { maxContentWidth: 190, maxContentHeight: 277, lineSpace: 1.5,
    defaultLineHeightFactor: 1.2, defaultFontSize: 12, defaultTitleFontSize: 14,
    topmargin: 10, xpading: 10, xmargin: 10, indent: 10 },
  font: { bold: { name: 'helvetica', style: 'bold' },
    regular: { name: 'helvetica', style: 'normal' },
    light: { name: 'helvetica', style: 'light' } },
  endCursorYHandler: (y) => console.log('Ended at Y:', y),
})

doc.save('output.pdf')
```

## Supported Elements

| Element | Syntax | Status |
|---------|--------|--------|
| Headings | `# H1` to `###### H6` | ✅ |
| Paragraphs | Plain text | ✅ |
| Bold / Italic | `**bold**` / `*italic*` | ✅ |
| Lists | `-` unordered, `1.` ordered, nested | ✅ |
| Links | `[text](url)` | ✅ |
| Images | `![alt](url){width=200 align=center}` | ✅ |
| Tables | GFM pipe tables | ✅ |
| Code Blocks | Fenced \` \`\`\` \` blocks | ✅ |
| Inline Code | \`\` \`code\` \`\` | ✅ |
| Blockquotes | `> quote` | ✅ |
| Horizontal Rules | `---` | ✅ |
