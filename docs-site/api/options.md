---
title: Options Reference
description: Complete RenderOption reference for jspdf-md-renderer, including security controls.
llm_summary: |
  RenderOption reference with page/font/layout controls, heading and list behavior,
  spacing precedence rules, and security options with violation modes and defaults.
---

# Options Reference

`RenderOption` controls layout, typography, spacing, rendering behavior, and optional security enforcement.

## Minimal Required Shape

```ts
import type { RenderOption } from 'jspdf-md-renderer'

const options: RenderOption = {
  cursor: { x: 10, y: 10 },
  page: {
    format: 'a4',
    unit: 'mm',
    orientation: 'portrait',
    maxContentWidth: 190,
    maxContentHeight: 277,
    lineSpace: 3,
    defaultLineHeightFactor: 1.4,
    defaultFontSize: 11,
    defaultTitleFontSize: 14,
    topmargin: 10,
    xpading: 10,
    xmargin: 10,
    indent: 8,
  },
  font: {
    bold: { name: 'helvetica', style: 'bold' },
    regular: { name: 'helvetica', style: 'normal' },
    light: { name: 'helvetica', style: 'light' },
  },
  endCursorYHandler: () => {},
}
```

## Layout and Typography

### Heading

```ts
heading: {
  bold: true,
  h1: 26,
  h2: 22,
  h3: 18,
  h4: 16,
  h5: 13,
  h6: 11,
  bottomSpacing: 3,
  color: '#1A365D',
  h1Color: '#7B2D00',
}
```

Behavior notes:
- `heading.bold` defaults to `true`.
- Size fallback chain is: `heading.hN` -> `page.defaultTitleFontSize`.

### Lists and Spacing

```ts
list: {
  bulletChar: '\u2022 ',
  indentSize: 8,
  itemSpacing: 0,
},
spacing: {
  betweenListItems: 1,
  afterList: 3,
}
```

Spacing precedence:
- `spacing.betweenListItems` has higher priority.
- `list.itemSpacing` is used only when `spacing.betweenListItems` is not set.

### Blockquotes

```ts
blockquote: {
  barColor: '#AAAAAA',
  barWidth: 1,
  paddingLeft: 4,
  backgroundColor: '#F8FAFC',
}
```

### Code Styling

```ts
codeBlock: {
  backgroundColor: '#F6F8FA',
  borderColor: '#E1E4E8',
  borderRadius: 3,
  padding: 5,
  fontSizeScale: 0.9,
  showLanguageLabel: true,
  textColor: '#111827',
  labelColor: '#6B7280',
},
codespan: {
  backgroundColor: '#EEEEEE',
  padding: 0.8,
  showBackground: true,
  fontSizeScale: 0.88,
}
```

### Table Width Behavior

Tables follow the same content column as other block elements:
- left margin follows `page.xpading + indent`
- width is constrained to `page.maxContentWidth - indent`

## Security Options (opt-in)

Security is disabled by default for backward compatibility.

```ts
security: {
  enabled: true,
  violationMode: 'skip', // 'skip' | 'throw' | 'placeholder'

  // Link controls
  allowedLinkProtocols: ['https:', 'http:', 'mailto:', 'tel:'],
  disablePdfLinks: false,

  // Image controls
  allowRemoteImages: true,
  allowedImageProtocols: ['https:', 'http:'],
  allowedImageDomains: ['cdn.example.com'],
  allowDataUrls: true,
  allowSvgImages: true,

  // SSRF controls
  blockLocalhost: true,
  blockPrivateIPs: true,
  blockLinkLocalIPs: true,
  blockMetadataIPs: true,

  // Limits
  maxMarkdownLength: 500_000,
  maxImageCount: 200,
  maxImageSizeBytes: 10 * 1024 * 1024,
  maxNestedDepth: 20,
  renderTimeoutMs: 30_000,

  // Hooks
  validateUrl: async (url, type) => true,
  onSecurityViolation: (violation) => console.warn(violation),

  // Placeholders
  placeholderText: '[blocked]',
  placeholderImageText: '[blocked image]',
}
```

### Violation Mode Behavior

- `skip`: block unsafe item and continue rendering.
- `throw`: throw `SecurityViolationError` and abort render.
- `placeholder`: render safe placeholder text instead of blocked content where supported.

### Domain Allowlist Semantics

- `allowedImageDomains: undefined` -> allow all domains.
- `allowedImageDomains: []` -> block all remote image domains.
- `allowedImageDomains: ['example.com']` -> allow `example.com` and subdomains.

### URL Classification Rules

Security URL validation treats URLs as:
- `explicitScheme` (for example `https://...`) -> full protocol/domain/IP checks.
- `protocolRelative` (for example `//host/path`) -> treated as external absolute URL and fully checked.
- `relativePath` (for example `/a`, `./a`, `../a`, `?q=1`, `#id`) -> allowed by default; custom `validateUrl` can still reject.

### Browser Runtime SSRF Note

In browser runtimes, DNS APIs are unavailable, so IP-level checks are best-effort only. The library warns when these checks cannot be fully enforced. For strict SSRF enforcement, route remote image fetching through a trusted server-side proxy.

## Full Type

See the generated type definition in source:
- `src/types/renderOption.ts`
- `src/types/security.ts`

## Related Pages

- [MdTextRender](/api/MdTextRender)
- [Links](/elements/links)
- [Images](/elements/images)
- [Security Guide](/guide/security)
