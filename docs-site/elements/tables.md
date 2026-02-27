---
title: Tables
description: How GFM tables are rendered in jspdf-md-renderer.
llm_summary: |
  Tables use GFM pipe syntax and are rendered via jspdf-autotable. Table styling can be
  customized by passing jspdf-autotable UserOptions through the table option in RenderOption.
---

# Tables

GFM (GitHub Flavored Markdown) pipe tables are rendered using [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable).

## Syntax

```markdown
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

## How It Renders

- Headers are rendered with bold styling
- Table is automatically sized to fit within `page.maxContentWidth`
- Cell content is text-only (inline formatting not supported in table cells)
- Tables that exceed the page height trigger automatic page breaks

## Customizing Table Styles

Pass [jspdf-autotable options](https://github.com/simonbengtsson/jsPDF-AutoTable#options) through the `table` option:

```ts
const options = {
  // ...other options
  table: {
    theme: 'grid',              // 'striped' | 'grid' | 'plain'
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: 255,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 250],
    },
    margin: { left: 10, right: 10 },
  },
}
```

## Relevant Options

| Option | Effect |
|--------|--------|
| `table` | Full `UserOptions` from jspdf-autotable — controls theme, colors, fonts, margins |
| `page.maxContentWidth` | Maximum table width |

## Try It

::: tip Interactive
Try this in the [Playground](/playground/) — paste the markdown above and click **Generate PDF**.
:::
