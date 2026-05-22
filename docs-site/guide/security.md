---
title: Security Guide
description: Secure-by-default usage patterns for untrusted markdown input.
llm_summary: |
  Explains how to enable security, choose violation modes, configure URL/image policy,
  SSRF controls, limits, hooks, and browser runtime caveats.
---

# Security Guide

`jspdf-md-renderer` keeps security **opt-in** for backward compatibility.
For trusted internal markdown, defaults are usually fine. For user input or external content, enable security explicitly.

## Enable Security

```ts
security: {
  enabled: true,
  violationMode: 'skip',
}
```

## Choose a Violation Mode

- `skip` (default): block unsafe content and continue rendering.
- `throw`: abort render with `SecurityViolationError`.
- `placeholder`: replace blocked content with placeholders.

```ts
security: {
  enabled: true,
  violationMode: 'placeholder',
  placeholderText: '[blocked link]',
  placeholderImageText: '[blocked image]',
}
```

## URL and Link Policy

```ts
security: {
  enabled: true,
  allowedLinkProtocols: ['https:', 'mailto:'],
  disablePdfLinks: false,
}
```

URL classes handled by validator:
- explicit scheme (`https://...`) -> fully validated
- protocol-relative (`//host/path`) -> treated as external absolute URL and fully validated
- relative path (`/a`, `./a`, `?q=1`, `#id`) -> allowed by default unless custom validator denies

## Image Policy

```ts
security: {
  enabled: true,
  allowRemoteImages: true,
  allowedImageProtocols: ['https:'],
  allowedImageDomains: ['cdn.example.com'],
  allowDataUrls: false,
  allowSvgImages: false,
}
```

Allowlist semantics:
- `allowedImageDomains: undefined` -> allow all domains
- `allowedImageDomains: []` -> allow none (block all remote image domains)

## SSRF Controls

```ts
security: {
  enabled: true,
  blockLocalhost: true,
  blockPrivateIPs: true,
  blockLinkLocalIPs: true,
  blockMetadataIPs: true,
}
```

These checks include IPv4 and IPv6/private-mapped variants.

## Limit Controls (DoS)

```ts
security: {
  enabled: true,
  maxMarkdownLength: 500_000,
  maxImageCount: 200,
  maxImageSizeBytes: 10 * 1024 * 1024,
  maxNestedDepth: 20,
  renderTimeoutMs: 30_000,
}
```

Notes:
- `maxImageSizeBytes` for data URLs uses decoded payload bytes.
- depth/image-count limits sanitize the parsed tree before rendering.

## Custom Hook Controls

```ts
security: {
  enabled: true,
  validateUrl: async (url, type) => {
    // extra business policy
    return true
  },
  onSecurityViolation: (violation) => {
    console.warn('security violation', violation)
  },
}
```

`onSecurityViolation` observes every violation regardless of mode.

## Browser Runtime Caveat

In browser runtime, DNS APIs are unavailable. IP-level SSRF checks are best-effort and warnings are emitted when strict checks cannot be fully enforced. For strict SSRF protection, route remote image fetching through a trusted server-side proxy.

## Recommended Production Baseline

```ts
security: {
  enabled: true,
  violationMode: 'skip',
  allowedLinkProtocols: ['https:', 'mailto:'],
  allowRemoteImages: true,
  allowedImageProtocols: ['https:'],
  allowedImageDomains: ['cdn.example.com'],
  allowDataUrls: false,
  allowSvgImages: false,
  blockLocalhost: true,
  blockPrivateIPs: true,
  blockLinkLocalIPs: true,
  blockMetadataIPs: true,
  maxMarkdownLength: 500_000,
  maxImageCount: 200,
  maxImageSizeBytes: 10 * 1024 * 1024,
  maxNestedDepth: 20,
  renderTimeoutMs: 30_000,
}
```
