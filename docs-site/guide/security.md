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

### Redirects

Remote image fetches follow redirects manually rather than transparently. Every
hop is re-validated against the same protocol, domain and SSRF rules as the
original URL, and the chain is bounded to 5 hops.

This matters because a permitted host would otherwise be able to redirect the
request to an address the policy forbids: validating only the URL the Markdown
supplied is not enough when the fetch itself follows the redirect.

## Limit Controls (DoS)

```ts
security: {
  enabled: true,
  maxMarkdownLength: 500_000,
  maxImageCount: 200,
  maxImageSizeBytes: 10 * 1024 * 1024,
  maxNestedDepth: 20,
  renderTimeoutMs: 30_000,
  imageFetchTimeoutMs: 10_000,
}
```

Notes:
- `maxImageSizeBytes` for data URLs uses decoded payload bytes.
- depth/image-count limits sanitize the parsed tree before rendering.
- `maxNestedDepth` counts **structural containers** — lists, list items,
  blockquotes and tables. Inline wrappers such as emphasis and links do not
  count, so the value matches Markdown nesting as an author would count it.
  Exceeding it drops the nested content, raises a
  `MAX_NESTED_DEPTH_EXCEEDED` violation, and reports how many nodes were
  dropped, so the omission is never silent.
- `imageFetchTimeoutMs` bounds each individual remote image request; `0`
  disables it. It is separate from `renderTimeoutMs`, which is only sampled at
  checkpoints between render phases and so cannot interrupt a request to a host
  that never responds.

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
  imageFetchTimeoutMs: 10_000,
}
```
