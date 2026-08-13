# Contributing

Use [GitHub Issues](https://github.com/iannuttall/seoskill-serpbase-provider/issues) for questions, bugs, and proposals. Search existing issues first and keep one problem in each issue.

Use the private process in [SECURITY.md](SECURITY.md) for suspected vulnerabilities. Never post API keys, provider responses, request IDs, or client data publicly.

## Before writing code

- Reproduce the problem with the smallest fake fixture.
- Keep each snapshot tied to its keyword, country, language, device, and collection time.
- Preserve provider credits, request IDs, page coverage, invalid rows, and quality warnings.
- Keep missing, invalid, partial, capped, and complete data separate.
- Add a regression test for each behavior change.

## Local checks

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm pack --dry-run
```

Keep pull requests focused. Use conventional commit subjects. Contributions use the Apache-2.0 license in [LICENSE](LICENSE).
