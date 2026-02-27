---
title: Lists
description: Ordered, unordered, and nested list rendering in jspdf-md-renderer.
llm_summary: |
  Supports unordered lists (-, *, +), ordered lists (1., 2.), and deeply nested lists.
  Nesting level multiplied by page.indent for indentation. Mixed list types supported.
---

# Lists

Unordered lists, ordered lists, and deeply nested combinations are all supported.

## Syntax

### Unordered Lists

```markdown
- Item 1
- Item 2
- Item 3
```

### Ordered Lists

```markdown
1. First item
2. Second item
3. Third item
```

### Nested Lists

```markdown
- Parent item
  - Child item
    - Grandchild item
- Another parent
  1. Numbered child
  2. Another numbered child
```

## How It Renders

- **Unordered items** get bullet markers (`•`)
- **Ordered items** get numeric markers (`1.`, `2.`, etc.)
- Indentation increases by `page.indent` for each nesting level
- List items can contain inline formatting (bold, italic, code, links)
- Mixed ordered/unordered nesting is fully supported

## Relevant Options

| Option | Effect |
|--------|--------|
| `page.indent` | Indentation per nesting level (default: 10mm) |
| `page.defaultFontSize` | Font size for list item text |
| `page.lineSpace` | Spacing between list items |

## Try It

::: tip Interactive
Try this element in the [Playground](/playground/) — paste the syntax above and click **Generate PDF**.
:::
