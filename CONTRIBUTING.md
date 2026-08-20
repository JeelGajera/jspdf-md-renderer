# Contributing

Thanks for helping improve `jspdf-md-renderer`.

## Getting started

```sh
git clone https://github.com/JeelGajera/jspdf-md-renderer.git
cd jspdf-md-renderer
npm ci
npm run verify   # lint + typecheck + tests with coverage
```

`npm ci` (not `npm install`) — the lockfile is committed on purpose. `marked`'s
tokenizer output is this library's layout input, so an unpinned dependency can
change rendered output without any commit here.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run verify` | Everything CI runs: lint, typecheck, tests |
| `npm test` | Tests with coverage |
| `npm run test:watch` | Tests in watch mode |
| `npm run typecheck` | `tsc --noEmit` over source and tests |
| `npm run lint` / `lint:fix` | ESLint over the repository |
| `npm run format` | Prettier |
| `npm run build` | Build `dist/` with tsdown |

## The golden snapshot suite

This is the most important thing to understand before changing anything that
draws.

jsPDF rendering is deterministic: the same markdown and options always produce
the same sequence of drawing operations at the same coordinates. `test/golden`
renders a corpus of markdown fixtures through a real `jsPDF` instance and
snapshots the full transcript — every glyph run, rule, box and image, with its
position.

Historically every bug in this project was a layout bug found by a user in
production, because nothing in the test suite asserted where content landed on
the page. These snapshots are that assertion.

**If your change moves anything, a snapshot will fail. That is the suite working.**

1. Read the diff. It shows exactly what moved and by how much.
2. Convince yourself every moved coordinate is intended.
3. Only then run `npx vitest run golden -u`.
4. Include the snapshot changes in your commit, and explain the visible effect
   in the commit message.

Never update snapshots to make a failure go away without reading the diff.

### Adding a fixture

Drop a `.md` file into `test/golden/fixtures/`. It is picked up automatically.
Add one whenever you fix a rendering bug, so the shape that was broken stays
covered.

## Changes that affect existing users' output

Split rendering changes into two kinds:

- **Output that was already wrong** — content dropped, covered, or printed as
  raw markup. Fixing it can only improve an existing document. These can ship in
  a minor release.
- **Output that already looked fine** — spacing, line breaking, alignment
  defaults. Changing these reflows documents that people have tuned. These need
  an option that defaults to the current behaviour, with the corrected behaviour
  opt-in until the next major.

`spacing.blankLines` and `breaks` are the current examples of the second kind.
See the scheduled default changes table in the
[Options Reference](https://jeelgajera.github.io/jspdf-md-renderer/api/options).

## Tests

- Layout and geometry → a golden fixture.
- Anything else → a focused test under `test/`.
- Security and rendering fixes must come with a regression test that fails
  before the fix.

Some behaviour cannot be seen in the golden transcript because it records the
order calls were *made*, not the order operations end up in the PDF content
stream. Paint order is the example — see
`test/rendering/blockquote-paint-order.test.ts`, which reads the stream
directly.

## Commit messages

Conventional Commits (`fix:`, `feat:`, `build:`, `test:`, `docs:`). Explain what
was wrong and what the user-visible effect of the change is, not just what code
moved.

## Reporting bugs

A markdown snippet plus the `RenderOption` object you used is worth more than a
description. That is usually enough to turn into a failing golden fixture.

Security issues: please follow [SECURITY.md](SECURITY.md) rather than opening a
public issue.
