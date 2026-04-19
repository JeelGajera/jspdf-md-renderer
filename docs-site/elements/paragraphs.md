---
title: Paragraphs
description: How paragraphs are rendered in jspdf-md-renderer.
llm_summary: |
  Paragraphs render as plain text blocks with configurable font size, line height, and text alignment.
  Support inline formatting (bold, italic, inline code, links) within paragraphs.
---

# Paragraphs

Plain text blocks separated by blank lines are rendered as paragraphs.

## Syntax

```markdown
This is the first paragraph. It can span multiple 
lines in the source and will be reflowed to fit 
the page width.

This is the second paragraph.
```

## Line Breaks

To create a hard line break without starting a new paragraph (which avoids the `page.lineSpace` gap), you can use the HTML `<br>` tag.

```markdown
This is line one.<br>
This is line two directly below it.
```

Note: Standard Markdown double-spaces at the end of a line are also supported by the underlying parser and will be converted to line breaks automatically.

## How It Renders

- Uses `page.defaultFontSize` and `font.regular`
- Text is word-wrapped to fit within `page.maxContentWidth`
- Paragraphs can contain inline elements: **bold**, *italic*, `code`, and [links](https://example.com)
- Vertical spacing between paragraphs is controlled by `page.lineSpace`

## Relevant Options

| Option | Effect |
|--------|--------|
| `page.defaultFontSize` | Font size for paragraph text |
| `page.maxContentWidth` | Maximum width before text wraps |
| `page.lineSpace` | Spacing between paragraphs |
| `page.defaultLineHeightFactor` | Line height within a paragraph |
| `font.regular` | Font used for regular text |
| `content.textAlignment` | Text alignment (left, right, center, justify) |

## Try It

::: tip Interactive
Try this in the [Playground](/playground/) — paste the markdown above and click **Generate PDF**.
:::
