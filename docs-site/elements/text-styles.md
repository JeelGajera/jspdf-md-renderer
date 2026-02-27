---
title: Text Styles
description: Bold, italic, and bold-italic text rendering in jspdf-md-renderer.
llm_summary: |
  Supports bold (**text** or __text__), italic (*text* or _text_), and bold-italic
  (***text*** or ___text___). Uses font.bold for bold, font.regular italic for italic.
  Inline code uses codespan options for styling.
---

# Text Styles

jspdf-md-renderer supports inline text formatting within paragraphs and other elements.

## Syntax

```markdown
**Bold text** or __bold text__
*Italic text* or _italic text_
***Bold and italic*** or ___bold and italic___
`Inline code`
```

## Supported Styles

| Style | Markdown | Font Used |
|-------|----------|-----------|
| Bold | `**text**` or `__text__` | `font.bold` |
| Italic | `*text*` or `_text_` | `font.regular` (italic style) |
| Bold Italic | `***text***` | `font.bold` (italic) |
| Inline Code | `` `text` `` | Monospace with background |

## Inline Code Styling

Inline code elements get special styling controlled by the `codespan` options:

| Option | Default | Description |
|--------|---------|-------------|
| `codespan.backgroundColor` | `'#EEEEEE'` | Background highlight color |
| `codespan.padding` | `0.5` | Padding around the code text |
| `codespan.showBackground` | `true` | Whether to show the background |
| `codespan.fontSizeScale` | `0.9` | Size relative to surrounding text |

## Try It

::: tip Interactive
Try this element in the [Playground](/playground/) — paste the syntax above and click **Generate PDF**.
:::
