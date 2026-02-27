---
title: Code Blocks
description: How fenced code blocks are rendered in jspdf-md-renderer.
llm_summary: |
  Fenced code blocks (triple backtick) are rendered with monospace font on a light background.
  Language identifier is parsed but not used for syntax highlighting. Code preserves whitespace and formatting.
---

# Code Blocks

Fenced code blocks are rendered with monospace font styling.

## Syntax

````markdown
```javascript
function hello() {
  console.log('Hello, world!');
}
```
````

## How It Renders

- Code is rendered in a monospace font
- A light background is drawn behind the code block
- Whitespace and indentation are preserved exactly
- The language identifier (e.g., `javascript`) is parsed but not used for syntax highlighting in the PDF
- Code blocks that exceed the page height trigger automatic page breaks

## Relevant Options

| Option | Effect |
|--------|--------|
| `page.defaultFontSize` | Base font size (code may be slightly smaller) |
| `page.maxContentWidth` | Maximum width of the code block |
| `page.lineSpace` | Spacing around the code block |

## Try It

::: tip Interactive
Try this element in the [Playground](/playground/) — paste the syntax above and click **Generate PDF**.
:::
