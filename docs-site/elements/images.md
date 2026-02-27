---
title: Images
description: Embedding and styling images in your PDF with jspdf-md-renderer.
llm_summary: |
  Images are rendered from URLs or base64. Use custom attributes {width=N height=N align=X}
  to control size and alignment. Width/height are in pixels and auto-scale to maintain
  aspect ratio. Global default alignment set via options.image.defaultAlign.
---

# Images

Embed images directly in your PDF from URLs or base64 data.

## Syntax

```markdown
![Alt text](https://example.com/image.png)
![Photo](https://example.com/photo.png){width=200 align=center}
![Logo](https://example.com/logo.png){h=150 align=right}
```

## Inline vs Block Images

Images can be rendered either as distinct blocks or inline with text. 

- **Block Images:** If an image is the *only* element in a paragraph (i.e. on its own line), it will render as a standalone block. Block images support the `align` attribute (`left`, `center`, `right`).
- **Inline Images:** If an image is mixed directly with text, the library automatically renders it inline, anchoring it to the text baseline so it flows naturally within the sentence. Inline images ignore the `align` attribute (since they follow the text flow) but fully support `width` and `height` adjustments.

```markdown
<!-- Block image -->
![photo](https://picsum.photos/400/200){align=center}

<!-- Inline image flow -->
Here is an inline LaTeX equation ![LaTeX](https://latex.codecogs.com/svg.image?e%20%3D%20mc%5E2) placed right inside the text!
```

## Custom Attributes

Add an attribute block `{...}` immediately after the image syntax to control sizing and alignment:

| Attribute | Alias | Type | Description |
|-----------|-------|------|-------------|
| `width` | `w` | `number` | Image width in pixels |
| `height` | `h` | `number` | Image height in pixels |
| `align` | — | `string` | `'left'` \| `'center'` \| `'right'` |

## Sizing Rules

- **No attributes** → renders at intrinsic (original) size, scaled down if exceeds page width
- **Width only** → height auto-calculated from aspect ratio
- **Height only** → width auto-calculated from aspect ratio
- **Both** → exact dimensions (may distort if aspect ratio differs)
- Images that exceed `page.maxContentWidth` are always scaled down proportionally

## Global Default Alignment

```ts
const options = {
  // ...other options
  image: {
    defaultAlign: 'center', // 'left' (default) | 'center' | 'right'
  },
}
```

Individual images can override this with the `align` attribute.

## Relevant Options

| Option | Effect |
|--------|--------|
| `image.defaultAlign` | Default alignment for all images |
| `page.maxContentWidth` | Maximum width — images scale down to fit |

## Examples

```markdown
<!-- Default size and alignment -->
![photo](https://picsum.photos/400/200)

<!-- Fixed width, auto height, centered -->
![photo](https://picsum.photos/400/200){width=150 align=center}

<!-- Fixed height, auto width, right-aligned -->
![photo](https://picsum.photos/400/200){h=80 align=right}

<!-- Both dimensions specified -->
![photo](https://picsum.photos/400/200){width=100 height=60}
```

## Try It

::: tip Interactive
Try this in the [Playground](/playground/) — paste the markdown above and click **Generate PDF**.
:::
