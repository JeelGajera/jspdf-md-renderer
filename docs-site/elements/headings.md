---
title: Headings
description: Heading rendering behavior and heading-specific options.
llm_summary: |
  Supports H1-H6 with configurable sizes/colors and heading.bold toggle.
  Size fallback uses page.defaultTitleFontSize when heading.hN is unset.
---

# Headings

Headings from `#` (H1) through `######` (H6) are supported.

## Syntax

```markdown
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

## Rendering Behavior

- Heading weight is controlled by `heading.bold`.
- `heading.bold` defaults to `true`.
- Size fallback chain: `heading.hN` -> `page.defaultTitleFontSize`.
- Color fallback chain: `heading.hNColor` -> `heading.color` -> `#000000`.

## Relevant Options

| Option | Effect |
|--------|--------|
| `heading.bold` | Toggles bold vs regular heading font |
| `heading.h1` ... `heading.h6` | Absolute font size per heading level |
| `heading.color` | Global heading color |
| `heading.hNColor` | Per-level heading color override |
| `heading.bottomSpacing` | Space below headings |
| `spacing.afterHeading` | Fallback spacing below headings |

## Example

```ts
heading: {
  bold: false,
  h1: 28,
  h2: 22,
  color: '#1F2937',
  h1Color: '#7C2D12',
}
```

## Try It

::: tip Interactive
Try this element in the [Playground](/playground/).
:::
