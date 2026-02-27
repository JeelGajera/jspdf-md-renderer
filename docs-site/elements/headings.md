---
title: Headings
description: How headings are rendered in jspdf-md-renderer.
llm_summary: |
  Headings # through ###### are supported. Rendered with defaultTitleFontSize using bold font.
  Depth affects font size scaling. Each heading adds vertical spacing before and after.
---

# Headings

Headings from `#` (H1) through `######` (H6) are fully supported.

## Syntax

```markdown
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

## How It Renders

- Headings use the **bold** font from your font configuration
- Font size is based on `page.defaultTitleFontSize`, scaled down by heading depth
- Vertical spacing is added before and after each heading
- Headings can contain inline formatting (bold, italic, code, links)

## Relevant Options

| Option | Effect |
|--------|--------|
| `page.defaultTitleFontSize` | Base font size for headings |
| `font.bold` | Font used for heading text |
| `page.lineSpace` | Spacing after the heading |

## Try It

::: tip Interactive
Try this element in the [Playground](/playground/) — paste the syntax above and click **Generate PDF**.
:::
