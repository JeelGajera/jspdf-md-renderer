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

## Custom Image Loader

Supply image data yourself with `image.load`, instead of (or before) the built-in `fetch`:

```ts
await MdTextRender(doc, markdown, {
    image: {
        // Read a local file in Node, send auth headers, resolve a relative
        // path against a base URL, or serve from a cache.
        load: async (src) => {
            if (src.startsWith('./assets/')) {
                const bytes = await fs.readFile(`./public/${src}`);
                return new Uint8Array(bytes); // or a Blob, or a data: URL string
            }
            return undefined; // fall back to the built-in fetch
        },
    },
});
```

- Called with the raw `src` before the built-in fetch runs.
- Return `undefined` to fall back to the built-in fetch for that image.
- A returned `string` is used as the image's `data:` URL as-is; `Uint8Array` bytes or a `Blob` are converted to a `data:` URL the same way fetched images are.
- A throwing loader is treated like a failed fetch: the image is skipped with an `IMAGE_LOAD_FAILED` warning.

**What the loader is and isn't responsible for:** with `security.enabled`, the URL checks run *before* the loader is called, so a blocked URL never reaches it. `security.maxImageSizeBytes` applies to whatever the loader returns, and the returned content itself is validated against the SVG (`allowSvgImages`) and data-URL (`allowDataUrls`) policies — an SVG returned while SVGs are disallowed is rejected with `SVG_BLOCKED`, and a non-image content type with `IMAGE_TYPE_BLOCKED`. The loader itself doesn't need to validate URLs or enforce size limits — the renderer does that around it. One exception: if the loader performs its own HTTP fetch instead of returning `undefined`, it is responsible for its own redirect and timeout enforcement inside the callback — the built-in fetch's redirect re-validation and `security.imageFetchTimeoutMs` do not apply to the loader's own requests.

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
| `image.load` | Custom image loader `(src) => Promise<string \| Uint8Array \| Blob \| undefined>`; `undefined` falls back to built-in fetch |
| `spacing.afterImage` | Spacing after images |
| `security.allowRemoteImages` | Allow or deny http/https image fetches |
| `security.allowedImageDomains` | Optional host allowlist (`undefined` allow-all, `[]` deny-all) |
| `security.maxImageSizeBytes` | Max image payload bytes |
| `security.placeholderImageText` | Placeholder text in placeholder mode |

## Try It

::: tip Interactive
Try this element in the [Playground](/playground/).
:::
