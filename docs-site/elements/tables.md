---
title: Tables
description: How GFM tables are rendered in jspdf-md-renderer.
llm_summary: |
  Tables use GFM pipe syntax and are rendered via jspdf-autotable. Column alignment is read
  from the delimiter row. Table styling can be customized by passing jspdf-autotable
  UserOptions through the table option in RenderOption.
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
- Column alignment is taken from the delimiter row (see below)
- Cell content renders as plain text — inline markup is read and its markers
  removed, but the styling itself is not applied (see [Cell content](#cell-content))
- Tables that exceed the page height trigger automatic page breaks

## Column Alignment

Alignment markers in the delimiter row are applied to the whole column,
header included.

```markdown
| Left | Center | Right |
|:-----|:------:|------:|
| a    | b      | c     |
```

| Delimiter | Alignment |
|-----------|-----------|
| `:---`    | Left |
| `:---:`   | Center |
| `---:`    | Right |
| `---`     | Default (left) |

An explicit `columnStyles` entry in the `table` option overrides the alignment
parsed from the Markdown.

## Cell Content

Cells render as plain text. Inline markup inside a cell is parsed and its
markers are stripped, so `**bold**` renders as `bold` rather than showing the
asterisks — but the emphasis itself is not applied, and a link renders as its
label without becoming clickable.

This is a limitation of drawing cells through jspdf-autotable, which has no
concept of mixed inline runs within a cell. Full inline styling inside cells is
planned.

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
| `spacing.afterTable` | Spacing added below the table |

## Try It

::: tip Interactive
Try this in the [Playground](/playground/) — paste the markdown above and click **Generate PDF**.
:::
