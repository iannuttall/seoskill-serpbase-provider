# Security

Do not open a public issue for a suspected vulnerability.

Use GitHub's [private security advisory form](https://github.com/iannuttall/seoskill-serpbase-provider/security/advisories/new). Include clear reproduction steps and the practical impact. Remove API keys, SerpBase responses, request IDs, private search data, and client data from every example.

Use [GitHub Issues](https://github.com/iannuttall/seoskill-serpbase-provider/issues) for ordinary questions and non-sensitive bugs.

## Credentials and data

The package receives credentials from the main `seo` package at run time. It does not own a separate credential store.

Never commit a SerpBase API key, include it in a fixture, or paste it into an issue. Use `SEO_SERPBASE_API_KEY` for agent and CI use. Keep real provider responses out of tests and logs.

## Maintainer checks

Run these checks before a public release:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm pack --dry-run
```

The release workflow also runs a secret scan and publishes through npm trusted publishing.
