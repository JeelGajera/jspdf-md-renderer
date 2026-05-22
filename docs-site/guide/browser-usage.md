---
title: Browser Usage
description: Use jspdf-md-renderer in browser runtime with or without a bundler.
llm_summary: |
  Browser usage with bundlers and UMD script tags, including globals and output methods.
---

# Browser Usage

## Option 1: Bundler (Vite/Webpack/Rollup)

```ts
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { MdTextRender } from 'jspdf-md-renderer'
```

## Option 2: UMD Script Tags

```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@latest/dist/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@latest/dist/jspdf.plugin.autotable.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf-md-renderer@latest/dist/index.umd.js"></script>
```

```html
<script>
  const { jsPDF } = window.jspdf
  const { MdTextRender } = window.JspdfMdRenderer
</script>
```

## Browser Security Note

If you enable `security.enabled`, be aware that DNS-based IP checks are best-effort in browser runtime. For strict SSRF protection, route remote image loading through a trusted server-side proxy.

## Common Output Methods

- `doc.save('file.pdf')`
- `doc.output('dataurlnewwindow')`
- `doc.output('blob')`
- `doc.output('arraybuffer')`
