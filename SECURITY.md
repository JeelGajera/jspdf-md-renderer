# Security Policy

## Supported Versions

This project is maintained by a single maintainer on a best-effort basis. Security
fixes are released against the latest `4.x` line. Older major versions are not
patched — please upgrade to the latest release.

| Version | Supported          |
| ------- | ------------------ |
| 4.x     | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report it privately through GitHub's Security Advisory feature:

1. Go to the [Security tab](../../security) of this repository.
2. Click **"Report a vulnerability"**.
3. Fill in as much detail as you can:
   - Affected version(s)
   - Vulnerability type (e.g. SSRF, DoS, injection)
   - Step-by-step reproduction / proof of concept
   - Impact you believe it has

This opens a private draft advisory that only you and the maintainer can see, so
the issue is not disclosed publicly before a fix is available.

If you don't have (or don't want to use) a GitHub account, you can alternatively
email **gajerajeel03@gmail.com** with the same information.

### What to expect

- **Acknowledgement:** within 5 business days.
- **Status update / triage decision:** within 14 days of acknowledgement.
- **Fix timeline:** depends on severity and complexity; critical issues are
  prioritized. As a solo-maintained project, please allow reasonable time before
  any public disclosure.
- **Credit:** with your permission, you will be credited in the published
  security advisory and release notes.

### Disclosure policy

This project follows a **coordinated disclosure** model:

- Please give the maintainer a reasonable window (suggested: 90 days, or sooner
  if a fix ships) to release a patch before any public disclosure of details.
- Once a fix is released, a GitHub Security Advisory will be published (and a
  CVE requested where applicable) describing the issue, affected versions, and
  the patched version.
- If a vulnerability is already public or being actively exploited, please say
  so in your report — that changes the urgency and timeline.

## Scope

In scope:
- The `jspdf-md-renderer` npm package source code (`src/`) and its published
  `dist/` build.
- Vulnerabilities involving processing of untrusted/attacker-controlled
  Markdown input (parsing, rendering, URL/image/link handling, resource
  limits).

Out of scope:
- Vulnerabilities solely in third-party dependencies (`jspdf`, `marked`,
  `jspdf-autotable`) that are not triggered through this library's own code —
  please report those upstream, but feel free to let us know so we can track
  and update the dependency.
- Issues that require an already-compromised environment, a malicious
  maintainer, or a malicious build pipeline.

## Preferred languages

English.
