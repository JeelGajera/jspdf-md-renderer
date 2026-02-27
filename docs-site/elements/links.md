---
title: Links
description: How hyperlinks are rendered in jspdf-md-renderer.
llm_summary: |
  Links render as clickable text with configurable color via link.linkColor RGB tuple.
  Syntax: [text](url). Links are rendered with underline and open in browser when clicked in PDF viewer.
---

# Links

Hyperlinks are rendered as clickable text in the PDF.

## Syntax

```markdown
[Link text](https://example.com)
```

## How It Renders

- Link text is colored (configurable via `link.linkColor`)
- Links are fully clickable in PDF viewers
- Links can appear inside paragraphs, list items, and headings

## Relevant Options

| Option | Effect |
|--------|--------|
| `link.linkColor` | RGB color tuple, e.g., `[0, 0, 255]` for blue |

## Example

```ts
const options = {
  // ...other options
  link: {
    linkColor: [0, 102, 204], // Custom link blue
  },
}
```

## Try It

::: tip Interactive
Try this in the [Playground](/playground/) — paste the markdown above and click **Generate PDF**.
:::
