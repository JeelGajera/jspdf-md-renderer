---
title: Images
description: Image rendering behavior, sizing attributes, and security controls.
llm_summary: |
  Images support URL and data sources, attribute-based sizing/alignment, intrinsic sizing,
  optional security restrictions for protocol/domain/SSRF, and placeholder behavior.
---

# Images

Render markdown images from remote URLs or data URLs.

## Syntax

```markdown
![Alt text](https://example.com/image.png)
![Photo](https://example.com/photo.png){width=200 align=center}
![Logo](data:image/png;base64,...){h=120 align=right}
```

## Attribute Controls

Use `{...}` after image markdown:

| Attribute | Alias | Type | Description |
|-----------|-------|------|-------------|
| `width` | `w` | `number` | Width in px |
| `height` | `h` | `number` | Height in px |
| `align` | - | `string` | `left` \| `center` \| `right` |

## Sizing Rules

- No attributes: intrinsic image size (scaled down to page bounds when needed).
- Width only: height auto-calculated to preserve aspect ratio.
- Height only: width auto-calculated to preserve aspect ratio.
- Width + height: exact dimensions (can distort aspect ratio).
- Final image is constrained by `page.maxContentWidth` and page height bounds.

## Block vs Inline

- Block image: image-only paragraph supports alignment.
- Inline image: image in text flow ignores block alignment and follows line layout.

## Security-Aware Behavior

When `security.enabled` is `true`, image handling can enforce:

- protocol allowlist (`allowedImageProtocols`)
- domain allowlist (`allowedImageDomains`)
- remote image toggle (`allowRemoteImages`)
- data URL toggle (`allowDataUrls`)
- SVG toggle (`allowSvgImages`)
- SSRF host/IP checks
- size limits (`maxImageSizeBytes`) using decoded bytes for data URLs
- image count and nesting limits at parsed-tree stage

Blocked images follow `violationMode`:
- `skip`: dropped
- `throw`: render aborts with `SecurityViolationError`
- `placeholder`: replaced with `placeholderImageText`

## Browser SSRF Note

In browser runtimes, DNS resolution APIs are not available, so IP-level SSRF checks are best-effort only. For strict SSRF policy, route remote image fetching through a trusted server-side proxy.

## Relevant Options

| Option | Effect |
|--------|--------|
| `image.defaultAlign` | Default alignment for block images |
| `spacing.afterImage` | Spacing after images |
| `security.allowRemoteImages` | Allow or deny http/https image fetches |
| `security.allowedImageDomains` | Optional host allowlist (`undefined` allow-all, `[]` deny-all) |
| `security.maxImageSizeBytes` | Max image payload bytes |
| `security.placeholderImageText` | Placeholder text in placeholder mode |

## Try It

::: tip Interactive
Try this element in the [Playground](/playground/).
:::
