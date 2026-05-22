---
title: Lists
description: Ordered, unordered, nested, and task-list rendering behavior.
llm_summary: |
  Supports ordered/unordered/task lists, nested indentation, bullet customization,
  and explicit spacing precedence between spacing.betweenListItems and list.itemSpacing.
---

# Lists

Unordered, ordered, nested, and task lists are supported.

## Syntax

### Unordered

```markdown
- Item 1
- Item 2
```

### Ordered

```markdown
1. First
2. Second
```

### Task Lists

```markdown
- [x] Done item
- [ ] Pending item
```

### Nested

```markdown
- Parent
  - Child
    1. Grandchild
```

## Rendering Behavior

- `list.bulletChar` applies to unordered list markers only.
- Ordered and task markers are rendered by their own logic.
- Indentation per level uses `list.indentSize` (fallbacks to `page.indent` via option normalization).
- Spacing precedence:
  - `spacing.betweenListItems` has priority.
  - `list.itemSpacing` is fallback when global spacing is not set.

## Relevant Options

| Option | Effect |
|--------|--------|
| `list.bulletChar` | Marker for unordered list items |
| `list.indentSize` | Additional indent per nesting level |
| `list.itemSpacing` | Fallback per-item spacing |
| `spacing.betweenListItems` | Primary per-item spacing |
| `spacing.afterList` | Spacing after full list block |

## Example

```ts
list: {
  bulletChar: '- ',
  indentSize: 8,
  itemSpacing: 1,
},
spacing: {
  betweenListItems: 2,
}
```

## Try It

::: tip Interactive
Try this element in the [Playground](/playground/).
:::
