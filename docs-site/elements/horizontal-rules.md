---
title: Horizontal Rules
description: How horizontal rules are rendered in jspdf-md-renderer.
llm_summary: |
  Horizontal rules (---, ***, ___) render as a full-width line across the content area.
  Used as visual separators between sections.
---

# Horizontal Rules

Horizontal rules render as a line spanning the content width, serving as visual separators.

## Syntax

Any of these produce a horizontal rule:

```markdown
---
***
___
```

## How It Renders

- Draws a horizontal line across the full `page.maxContentWidth`
- Adds vertical spacing above and below the line
- Useful for separating sections or adding visual breaks

## Relevant Options

| Option | Effect |
|--------|--------|
| `page.maxContentWidth` | Width of the horizontal line |
| `page.lineSpace` | Spacing above and below the rule |

## Try It

::: tip Interactive
Try this element in the [Playground](/playground/) — paste the syntax above and click **Generate PDF**.
:::
