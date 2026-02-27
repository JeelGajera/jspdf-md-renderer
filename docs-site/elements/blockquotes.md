---
title: Blockquotes
description: How blockquotes are rendered in jspdf-md-renderer.
llm_summary: |
  Blockquotes use > prefix syntax. Rendered with a left border line and indented text.
  Can contain nested elements including paragraphs, lists, and other blockquotes.
---

# Blockquotes

Blockquotes render with a visual left border and indented text.

## Syntax

```markdown
> This is a blockquote.
> It can span multiple lines.

> Blockquotes can contain **formatted text** and other elements.
```

## How It Renders

- A vertical line is drawn on the left side of the blockquote
- Text is indented from the left border
- Blockquotes can contain inline formatting (bold, italic, code)
- Nested content within blockquotes is supported

## Relevant Options

| Option | Effect |
|--------|--------|
| `page.defaultFontSize` | Font size for blockquote text |
| `page.indent` | Indentation for the blockquote content |
| `font.regular` | Font used for blockquote text |

## Try It

::: tip Interactive
Try this element in the [Playground](/playground/) — paste the syntax above and click **Generate PDF**.
:::

