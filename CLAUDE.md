# Working conventions

Conventions for anyone — human or agent — working in this repository.

## Commits

- **Author identity:** commits are authored as the contributor who made them —
  whatever `git config user.name` / `user.email` resolves to for that person.
  Never substitute a shared, generic or tooling identity.
- **No AI attribution.** Do not add `Co-Authored-By: Claude …`, `Claude-Session:`,
  `Generated with …` or any similar trailer to commit messages. An agent working
  on someone's behalf commits as that person, with no extra trailers.
- **No tooling signatures.** If the environment has `commit.gpgsign` on with a
  signing key that is not the contributor's own (agent sandboxes often ship
  one), turn it off for this repo — `git config commit.gpgsign false` — before
  committing. A commit signed by a key GitHub cannot tie to the author shows a
  red *Unverified* badge; an unsigned commit shows no badge at all, which is
  the better of the two. Check with `git config --show-origin --get
  commit.gpgsign`.
- **Conventional Commits** for the subject: `fix(renderer): …`, `feat(layout): …`,
  `build:`, `test:`, `docs:`, `ci:`, `chore:`. Scope where it clarifies.
- Explain what was wrong and what the user-visible effect of the change is, not
  just which code moved. See `f24cf93` for the house style: a scoped subject
  followed by a terse bulleted body.

## Branches

- Name the branch after the change, with a conventional prefix:
  `fix/blockquote-paint-order`, `feat/margin-page-geometry`,
  `docs/sync-4-2-options`, `ci/node-matrix`.
- No fixed or session-derived prefixes.

## Releases

- The version bump lives on the default branch and is cut at release time. Feature
  branches must not touch `version` in `package.json`.
- Release notes live in GitHub Releases; this repo has no `CHANGELOG.md`.
- Tags are `vX.Y.Z` and must match `package.json` — `publish.yml` enforces this.

## Testing

Before pushing: `npm run verify` (lint + typecheck + tests). For anything that
touches packaging, also `bash scripts/smoke-package.sh`.

### The golden snapshot suite

`test/golden` renders markdown fixtures through a real `jsPDF` and snapshots the
full drawing transcript — every glyph run, rule, box and image, with coordinates.
It exists because every bug ever filed on this project was a layout bug found by
a user in production, and nothing asserted where content lands on the page.

**If a change moves anything, a snapshot fails. That is the suite working.**
Read the diff, confirm every moved coordinate is intended, and only then run
`npx vitest run golden -u`. Never update snapshots to silence a failure.

Add a fixture to `test/golden/fixtures/` whenever you fix a rendering bug.

## Changes that affect existing users' output

Sort every rendering change into one of two buckets:

- **Output that was already wrong** — content dropped, covered, or printed as raw
  markup. Fixing it can only improve an existing document. Ships in a minor.
- **Output that already looked fine** — spacing, line breaking, alignment
  defaults. Changing it reflows documents people have tuned. Needs an option
  defaulting to current behaviour, with the correction opt-in.

`spacing.blankLines` and `breaks` are the existing examples of the second kind.
Their defaults preserve 4.1.x output and are not to be flipped in a minor.
