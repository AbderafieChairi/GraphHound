# Contributing to GraphHound

Thanks for your interest in improving GraphHound! Contributions of all sizes are welcome: bug reports, query packs, docs and code.

## Ground rules

- GraphHound is intended for **authorized** security testing, red/blue-team work, CTFs and education. Contributions that primarily enable unauthorized access or evade detection will not be accepted.
- **Never commit real collection data** (SharpHound JSON, `data/*.db`) or anything containing customer names, hostnames, credentials or hashes. Use sanitized or synthetic samples.
- By contributing, you agree that your contributions are licensed under the project's [Apache-2.0 license](LICENSE).

## Development setup

Requirements: [Bun](https://bun.sh) 1.3+ and Node.js 22.5+.

```bash
bun install
bun run dev        # start the dev server
```

Before opening a pull request, run the same checks CI does:

```bash
bun run typecheck
bun run test
bun run build
bun run lint
```

## Workflow

1. Fork the repo and create a branch from `main` (`feat/...`, `fix/...`, `docs/...`).
2. Keep changes focused. One logical change per pull request.
3. Add or update tests in `tests/` for logic changes (pure helpers in `src/lib` are easiest to test).
4. Run `bun run format` so the code matches the Prettier config.
5. Use clear commit messages, e.g. `fix: handle empty path results in PathFinder`.
6. Open a pull request against `main` describing **what** changed and **why**, with screenshots for UI changes. CI must pass before merge.

## Reporting bugs & requesting features

Open a GitHub issue with:

- What you did, what you expected, and what happened
- GraphHound version / commit, OS, Node and Bun versions
- Console or server logs (redact sensitive data)

## Security issues

Please **do not** open public issues for vulnerabilities in GraphHound itself. Report them privately through GitHub Security Advisories ("Report a vulnerability" on the repository's Security tab).

## Contributing query packs

Cypher packs live in `examples/`. Follow the format documented in `src/lib/registry/cypher-parser.ts`: a `#` divider plus `# Section` header, then `## Query name` followed by the query. The test suite parses every pack in `examples/`, so `bun run test` validates your file.
