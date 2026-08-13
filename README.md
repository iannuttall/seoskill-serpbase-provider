# SerpBase provider for `seo`

Add live Google result snapshots from SerpBase to the reports and rank tracking tools in the `seo` command.

The package keeps the SerpBase adapter outside the main `seo` package. The main package still owns installation, credentials, request and spend limits, caching, report logic, and evidence labels.

## Requirements

- Node.js 22.19 or newer
- `seo` 0.2.34 or newer
- A SerpBase API key with available credits

Install the main command first:

```sh
npm install --global seo
```

## Install the provider

Install this package through the reviewed provider list. The command shows the package, publisher, repository, and local permission warning before it installs code.

```sh
seo providers install serpbase
```

For JSON or CI use, approve the exact package without a prompt:

```sh
seo providers install serpbase --yes --json
```

The provider loader only runs packages recorded in the local provider registry. It does not scan project or global `node_modules` directories.

## Connect SerpBase

Connect the provider and enter the API key when asked:

```sh
seo providers connect serpbase
```

Connection verification runs one billed Google Search request. The command shows this warning before the request in interactive mode.

The API key is stored in the managed secret store. On supported systems, this uses the operating system keychain. A private local credential file is the fallback.

Agents and CI can provide the API key through an environment variable:

```sh
export SEO_SERPBASE_API_KEY="your-api-key"
seo providers connect serpbase --json
```

Do not commit the API key or add it to a command argument.

Check the saved connection with another billed request only when you need to verify live access:

```sh
seo providers status serpbase --check
```

Read the saved status without a new request:

```sh
seo providers status serpbase
```

## Run a live result report

Inspect the report input before paid work:

```sh
seo reports describe serp-results --json
```

Run one Google result snapshot through SerpBase:

```sh
seo reports run serp-results \
  --params '{"keyword":"local seo software","countryCode":"US","languageCode":"en","device":"mobile","provider":"serpbase","depth":10}' \
  --json
```

The package registers the shared `serp-snapshot` capability. It does not add a provider command or a separate report. Compatible reports can select `serpbase` through the existing provider field.

## Track exact rankings

SerpBase can collect the live result part of rank tracking. The main package owns keyword sets, schedules, history, comparison rules, and report output.

Start by reading the current report contract:

```sh
seo reports describe rank-tracking --json
```

Choose SerpBase as the rank provider when you create or run the tracking job. The command checks the total keywords, devices, pages, and local request limit before it starts paid work.

## Supported search input

| Input | Support |
| --- | --- |
| Search engine | Google |
| Market | Two-letter uppercase country code |
| Language | Lowercase language code |
| Device | Desktop or mobile |
| Exact location | Not supported by this adapter |
| Keyword | Up to 80 characters and 10 words |
| Depth | 1 to 100 organic positions |

Do not pass a canonical location. This adapter uses country-level markets. A request for `GB` and `en` does not prove the searcher's exact location.

## Requests, credits, and cost evidence

SerpBase returns 10 organic positions per requested page. The package uses one request for depths 1 to 10, two requests for depths 11 to 20, and up to 10 requests for depth 100.

The local preflight estimate uses 500 USD micros for each request. This is a conservative accounting value, not an account invoice. SerpBase returns charged credits but does not return their account-specific monetary value. The result keeps these values separate:

- estimated local monetary cost
- actual charged SerpBase credits
- request IDs
- requested and collected pages

Inspect or change local limits before a larger run:

```sh
seo providers limits serpbase
seo providers limits serpbase --requests 10 --daily-limit 1.00
seo providers spend serpbase
```

## What the evidence means

A live snapshot is one observation for one keyword, country, language, device, and collection time. It is not proof of a stable ranking or a universal result order.

The package validates provider responses and maps only organic rows with a valid whole rank and HTTP or HTTPS URL. It keeps provider features, returned and retained row counts, invalid row counts, coverage state, page count, request IDs, and charged credits in structured evidence.

If a later page fails, results from earlier pages are retained and the coverage is marked as partial. Invalid rows also make coverage partial. A depth limit can make coverage capped. Partial or capped output cannot support a definitive absence claim.

Positions after page one use the requested page and the provider's page-relative rank, with 10 organic positions per page. The report includes a quality warning when this calculation applies.

This adapter does not return a local pack. It records that boundary instead of treating missing local results as a verified zero.

## Network access

Requests go to `https://api.serpbase.dev/google/search`. The API key is sent in the `x-api-key` request header. The request body includes the keyword, country, language, page, and device needed for the selected snapshot.

## Disconnect or remove the package

Remove the saved managed secret:

```sh
seo providers disconnect serpbase
```

Environment variables remain under the control of your shell.

Remove the installed package from the local provider registry:

```sh
seo providers remove serpbase
```

## Agent use

Agents should inspect the report with `seo reports describe <report-id> --json`, then select `serpbase` as the provider. The same shared capability is available to the CLI, MCP server, and TypeScript report APIs through the main package.

The adapter returns normalized evidence. It cannot add findings, report text, public commands, MCP tools, or skill files.

## Development

Clone the repository and run the full local checks:

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm pack --dry-run
```

The tests cover registration, live result and cost mapping, and partial evidence when a later page fails.

This package has no runtime dependency tree. It imports provider types from the public `seo/provider-sdk` entry point and bundles its adapter into one ESM entry file.

## Releases

The package is published as [`@seoskill/serpbase-provider`](https://www.npmjs.com/package/@seoskill/serpbase-provider). A version change in `package.json` on `main` starts the release workflow. GitHub Actions runs the checks, publishes with npm trusted publishing and provenance, then creates the matching `v<version>` Git tag.

## Security

Do not post API keys, SerpBase responses, private search data, or client data in a public issue. Use the [private security advisory form](https://github.com/iannuttall/seoskill-serpbase-provider/security/advisories/new) for a suspected vulnerability.

## License

Apache-2.0. See [LICENSE](LICENSE).
