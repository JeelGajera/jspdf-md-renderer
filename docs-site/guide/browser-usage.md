---
title: Browser Usage
description: Use jspdf-md-renderer directly in the browser with or without a bundler.
llm_summary: |
  Two browser usage approaches: (1) With bundler (Vite/Webpack) using standard ESM imports,
  (2) Without bundler using UMD script tags from CDN. Access via window.jspdf.jsPDF and
  window.JspdfMdRenderer.MdTextRender. Full standalone HTML example provided.
---

# Browser Usage

jspdf-md-renderer works entirely client-side. There are two approaches to use it in the browser.

## Option 1: With a Bundler

If you're using Vite, Webpack, Rollup, or another bundler, simply install and import:

```ts
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { MdTextRender } from 'jspdf-md-renderer'

async function generateInBrowser() {
  const doc = new jsPDF()

  await MdTextRender(doc, markdownContent, options)

  // Open in new tab
  doc.output('dataurlnewwindow')

  // Or download
  doc.save('document.pdf')

  // Or get as blob for an iframe preview
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  document.querySelector('iframe').src = url
}
```

## Option 2: UMD Script Tags (No Build Step)

Load all dependencies from CDN, then use the global objects:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Markdown to PDF</title>
</head>
<body>
  <textarea id="editor" rows="10" cols="60">
# Hello World

This is **bold** and *italic* text.

- Item 1
- Item 2
- Item 3

| Name | Score |
|------|-------|
| Alice | 95 |
| Bob | 87 |
  </textarea>
  <br />
  <button onclick="generate()">Generate PDF</button>

  <!-- Load dependencies in order -->
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jspdf@latest/dist/jspdf.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@latest/dist/jspdf.plugin.autotable.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jspdf-md-renderer@latest/dist/index.umd.js"></script>

  <script>
    async function generate() {
      const { jsPDF } = window.jspdf
      const { MdTextRender } = window.JspdfMdRenderer
      const md = document.getElementById('editor').value

      const doc = new jsPDF({ unit: 'mm', format: 'a4' })

      await MdTextRender(doc, md, {
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
        endCursorYHandler: () => {},
      })

      doc.save('output.pdf')
    }
  </script>
</body>
</html>
```

::: tip Output Methods
jsPDF provides several output methods:
- `doc.save('file.pdf')` — downloads as a file
- `doc.output('dataurlnewwindow')` — opens in a new browser tab
- `doc.output('blob')` — returns a Blob for `<iframe>` preview or upload
- `doc.output('arraybuffer')` — returns raw data for further processing
:::

## Global Objects Reference

When using UMD script tags, the libraries expose these globals:

| Global | Contents |
|--------|----------|
| `window.jspdf` | `{ jsPDF }` — the jsPDF constructor |
| `window.JspdfMdRenderer` | `{ MdTextRender, MdTextParser }` — renderer and parser |
| `window.marked` | The marked markdown parser (used internally) |
