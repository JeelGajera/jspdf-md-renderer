# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.2.0] - Unreleased

A reliability release. It fixes a crash, a security bypass, and a set of defects
where content was silently dropped or printed as raw markup.

**Upgrading from 4.1.x will not move anything on your pages.** Every change that
would reflow an already-correct document is behind an option that defaults to
the current behaviour. This is verified by a new golden snapshot suite: all
existing snapshots are byte-identical under default options.

### Added

- **Golden layout regression tests.** The full jsPDF drawing transcript —
  every glyph run, rule, box and image, with coordinates — is now snapshotted
  for a corpus of 22 markdown fixtures rendered through a real `jsPDF`
  instance. Layout changes are now visible in review as exact coordinate diffs.
- **`spacing.blankLines`** (`'preserve' | 'collapse'`, default `'preserve'`).
  `'collapse'` makes the `spacing.*` options the only source of inter-block
  gaps. See *Deprecations* below.
- **`breaks`** (`boolean`, default `true`). `false` renders a single newline as
  a space, per CommonMark. See *Deprecations* below.
- **`security.imageFetchTimeoutMs`** (default `10000`, `0` disables). Bounds
  each remote image request. `renderTimeoutMs` is only sampled between render
  phases and cannot interrupt an unresponsive socket.
- GFM strikethrough (`~~text~~`) now renders with a rule drawn across the text.
- Table column alignment from the delimiter row (`|:--|:-:|--:|`).
- `npm run typecheck` and `npm run verify` scripts.

### Fixed

- **Code blocks could hang the process.** When the usable page height was
  smaller than one line of code, the pagination loop added pages forever.
  Reproduced at 5,000+ pages and an out-of-memory kill of the Node process;
  `security.renderTimeoutMs` did not help, because the loop is synchronous and
  contained no checkpoint. It now renders one line per page with a warning
  naming the option to adjust.
- **Remote images never loaded outside a browser.** Blob conversion used
  `FileReader`, which is not a Node global. The resulting `ReferenceError` was
  swallowed and downgraded to a warning, so every server-side render silently
  dropped all remote images. Data-URL images were unaffected, which is why this
  went unnoticed.
- **SSRF protections were bypassed by an HTTP redirect.** URL validation ran
  before `fetch`, which then followed redirects transparently without
  revalidating the target, so a permitted host could redirect the request to an
  internal address. Redirects are now taken manually and every hop is
  revalidated, with a bounded hop count.
- **Block content nested in a list item was silently discarded** — fenced code,
  blockquotes, tables and rules inside a list item never reached the page.
- **Blockquote backgrounds painted over their own text.** Setting
  `blockquote.backgroundColor` erased the quote's text, because the background
  was emitted after the content it was meant to sit behind.
- **`security.maxNestedDepth` measured AST depth, not markdown depth.** The
  effective ceiling was roughly 9 markdown list levels rather than the
  documented 20, and exceeding it dropped the subtree with no signal under the
  default `'skip'` mode. Only structural containers now count, and the number of
  dropped nodes is reported.
- **Code blocks ignored indentation**, drawing the box at the page margin with
  the full content width regardless of nesting, so a block inside a blockquote
  overlapped the quote bar. The language label also shared a baseline with the
  first line of code and overlapped it.
- **Escaped characters, strikethrough and link reference definitions printed
  their own markup** — `\*` rendered as `\*`, `~~text~~` kept its tildes, and
  `[ref]: https://…` was printed into the document as body text. A sentence
  containing an escape was also broken across several lines.
- **HTML comments leaked into the document.** The tag stripper stopped at the
  first `>`, so `<!-- a > b -->` left `b -->` visible. A sentence containing
  inline HTML tags also broke onto a new line at every tag boundary.
- **Horizontal rules ignored `page.maxContentWidth`**, deriving their right edge
  from the physical page instead.
- **Table cells rendered raw markdown** — readers saw literal `**bold**` and
  `[label](url)`.
- **An image that failed to load rendered nothing**, dropping its alt text as
  well. It now falls back to the alt text.
- **Rendering twice into one document duplicated headers and footers** on pages
  the earlier call had already decorated.
- `hr.ts` referenced `jsPDF` without importing it — a type error in shipped
  source, caught by the new typecheck step.

### Changed

- **The `exports["./types"]` subpath is removed.** It pointed at
  `./dist/types/index.d.ts`, which the build has never emitted, so
  `jspdf-md-renderer/types` never resolved. All public types are re-exported
  from the package root: `import type { RenderOption } from 'jspdf-md-renderer'`.
- ESM and CJS now resolve to their matching declaration files.
- `package.json` gains `sideEffects: false` and `engines.node >= 20`,
  matching the Node versions CI actually verifies.

### Release engineering

- **`package-lock.json` is now committed** and both workflows use `npm ci`.
  Dependency resolution was previously unpinned, and `marked`'s tokenizer output
  is this library's layout input, so a dependency patch release could change
  rendered output with no commit in this repository.
- **Publishing is gated** on lint, typecheck, tests and a tarball smoke test,
  and verifies the git tag matches `package.json`. Previously `npm publish` ran
  after only a build. Published with `--provenance`.
- `scripts/smoke-package.sh` packs the library, installs the tarball into a
  clean project and renders a document through CJS, ESM and UMD, asserting the
  declaration files are non-empty (guards the regression in #60).
- CI runs against Node 20, 22 and 24 instead of 24 alone. The bundle step is
  skipped on Node 20, where the build tool itself is unsupported; the separate
  `package` job builds and smoke-tests the real artifact.
- Lint covers the whole repository rather than `src/**` only.

### Deprecations

The following defaults change in the next major version. Both are available now
as opt-in options; setting them explicitly makes the upgrade a no-op.

| Option | 4.2 default | Next major | Opt in today |
| --- | --- | --- | --- |
| `spacing.blankLines` | `'preserve'` | `'collapse'` | `spacing: { blankLines: 'collapse' }` |
| `breaks` | `true` | `false` | `breaks: false` |

### Known limitations

- Inline emphasis inside table cells is flattened to plain text. autoTable draws
  cell content itself and has no notion of mixed inline runs; faithful styling
  needs a custom cell renderer.
- Inline HTML tags (`<strong>`, `<em>`) render their text without applying the
  style, because marked emits the opening tag, the text and the closing tag as
  separate tokens.
- `cursor.x` applies only to the first line; every block then resets to
  `page.xpading`. This is left for the margin-based page geometry rework.

## [4.1.1] and earlier

See the [release history](https://github.com/JeelGajera/jspdf-md-renderer/releases).
