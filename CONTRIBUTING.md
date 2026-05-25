# Contributing

Thanks for contributing to `jspdf-md-renderer`.

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:

```sh
npm install
```

3. Build once:

```sh
npm run build
```

## Local Commands

```sh
npm run build      # Build dist bundles and type declarations
npm run lint       # Lint source
npm test           # Run Vitest suites with coverage
npm run test:watch # Run Vitest in watch mode
npm run format     # Format repository with Prettier
```

## Testing Expectations

- Run `npm run lint`, `npm run build`, and `npm test` before opening a PR.
- If you fix a bug or regression, add or update a targeted test that fails without your change.
- Security and rendering changes should include deterministic tests (avoid brittle binary PDF snapshots).

## Security-Related Changes

If your PR touches URL/image handling, markdown guards, or option normalization:

1. Update docs in all relevant places:
   - `README.md`
   - `docs-site/api/options.md`
   - `docs-site/guide/security.md`
   - affected element/API docs
2. Keep defaults backward compatible unless a breaking change is intentional.

## Coding Expectations

- Prefer small, focused commits.
- Preserve public API compatibility unless explicitly planning a major version change.
- Keep option behavior consistent with type docs and README.
- Add concise comments only where behavior is non-obvious.

## Documentation Expectations

When adding or changing render/security behavior:

- document option defaults
- document precedence/fallback rules
- document runtime caveats (for example browser SSRF limitations)
- document violation mode behavior for user-visible outcomes

## Pull Request Checklist

Before opening a PR, verify:

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] docs updated (`README` + `docs-site` pages)
- [ ] examples/snippets reflect current API
- [ ] no unrelated file churn

## Branching and Commits

Use descriptive branch names and commit messages, for example:

```sh
git checkout -b fix/security-protocol-relative-url-validation
git commit -m "fix(security): validate protocol-relative URLs as external"
```

## Submitting a PR

1. Push your branch.
2. Open a PR against `main`.
3. Include:
   - what changed
   - why it changed
   - test and docs updates
   - any migration notes
