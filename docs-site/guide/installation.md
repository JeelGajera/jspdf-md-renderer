---
title: Installation
description: Install jspdf-md-renderer via npm, CDN, or bundler.
llm_summary: |
  Three installation methods: (1) npm/yarn/pnpm for ESM import, (2) CDN script tags for UMD with
  load order marked → jspdf → jspdf-autotable → jspdf-md-renderer, (3) bundler (Vite/Webpack) standard import.
---

# Installation

## Package Manager (Recommended)

Install with npm, yarn, or pnpm:

::: code-group

```bash [npm]
npm install jspdf-md-renderer
```

```bash [yarn]
yarn add jspdf-md-renderer
```

```bash [pnpm]
pnpm add jspdf-md-renderer
```

:::

Then import in your code:

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender, MdTextParser } from 'jspdf-md-renderer'
```

## CDN / Script Tags (UMD)

For use directly in the browser without a build step, load dependencies via CDN in this **exact order**:

```html
<!-- 1. Marked (markdown parser) -->
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

<!-- 2. jsPDF -->
<script src="https://cdn.jsdelivr.net/npm/jspdf@latest/dist/jspdf.umd.min.js"></script>

<!-- 3. jspdf-autotable (table plugin) -->
<script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@latest/dist/jspdf.plugin.autotable.min.js"></script>

<!-- 4. jspdf-md-renderer -->
<script src="https://cdn.jsdelivr.net/npm/jspdf-md-renderer@latest/dist/index.umd.js"></script>
```

::: warning Load Order Matters
The scripts **must** load in the order shown above. `jspdf-md-renderer` depends on `marked`, `jspdf`, and `jspdf-autotable` being available as globals.
:::

Then use via globals:

```html
<script>
  const { jsPDF } = window.jspdf
  const { MdTextRender } = window.JspdfMdRenderer

  ;(async () => {
    const doc = new jsPDF()
    await MdTextRender(doc, '# Hello from the browser!', {
      cursor: { x: 10, y: 10 },
      page: { maxContentWidth: 190, maxContentHeight: 277, lineSpace: 1.5,
        defaultLineHeightFactor: 1.2, defaultFontSize: 12, defaultTitleFontSize: 14,
        topmargin: 10, xpading: 10, xmargin: 10, indent: 10 },
      font: { bold: { name: 'helvetica', style: 'bold' },
        regular: { name: 'helvetica', style: 'normal' },
        light: { name: 'helvetica', style: 'light' } },
      endCursorYHandler: () => {},
    })
    doc.save('browser-output.pdf')
  })()
</script>
```

## Bundler (Vite / Webpack)

If you're using a modern bundler, simply install via npm and import:

```ts
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { MdTextRender } from 'jspdf-md-renderer'
```

Both Vite and Webpack will resolve the ESM entry point automatically. No additional bundler configuration is needed.

### TypeScript Support

jspdf-md-renderer ships with full TypeScript declarations. You can import the `RenderOption` type for type-safe options:

```ts
import { MdTextRender, type RenderOption } from 'jspdf-md-renderer'
```
