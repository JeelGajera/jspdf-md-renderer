---
title: Links
description: Link rendering and security controls.
llm_summary: |
  Markdown links can render as clickable PDF links, plain text, or placeholders
  depending on security settings such as disablePdfLinks and violationMode.
---

# Links

Markdown links use standard syntax:

```markdown
[Project docs](https://example.com/docs)
```

## Default Behavior

- Link text renders inline.
- Link color can be customized via `link.linkColor`.
- PDF link action is added when allowed.

## Anchor Links to Headings

Links whose target starts with `#` jump to a heading inside the PDF instead
of opening a URL:

```markdown
# Getting Started

Jump to [Getting Started](#getting-started) to begin.
```

While rendering, each heading is given a GitHub-style slug (`My Heading` →
`my-heading`; repeated headings get `-1`, `-2` suffixes) and its page and
position are recorded. A link like `[text](#my-heading)` then becomes an
internal PDF link to that heading — even when the link appears before the
heading it points at.

- The fragment must match the heading's lowercase slug (`#My-Heading` will
  not match `my-heading`).
- An anchor that matches no heading keeps the default URL-link behaviour.
- When `security.enabled` is `true`, anchor links follow the same
  link-policy rules as any other link.

## Security-Aware Behavior

When `security.enabled` is `true`:

- URLs are validated by protocol and optional custom policy.
- If `security.disablePdfLinks` is `true`, link text remains but click action is removed.
- Blocked links follow `violationMode`:
  - `skip`: render as plain text
  - `throw`: abort render with `SecurityViolationError`
  - `placeholder`: replace with `security.placeholderText`

## Relevant Options

| Option | Effect |
|--------|--------|
| `link.linkColor` | RGB tuple for link text color |
| `security.disablePdfLinks` | Removes clickable PDF action |
| `security.allowedLinkProtocols` | Allowed protocols (for example `https:`) |
| `security.validateUrl` | Custom link/image URL validation hook |
| `security.violationMode` | `skip` / `throw` / `placeholder` |
| `security.placeholderText` | Placeholder text for blocked links |

## Example

```ts
security: {
  enabled: true,
  allowedLinkProtocols: ['https:', 'mailto:'],
  disablePdfLinks: false,
  violationMode: 'placeholder',
  placeholderText: '[blocked link]',
}
```

## Try It

::: tip Interactive
Try this element in the [Playground](/playground/).
:::
