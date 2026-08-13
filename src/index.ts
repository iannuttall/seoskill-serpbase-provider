import type {
  SeoProviderActivate,
  SeoProviderConnection,
  SeoProviderRuntime,
  SeoSearchMarket,
  SeoSerpOrganicResult,
  SeoSerpSnapshotResult,
} from 'seo/provider-sdk'

const SEARCH_ENDPOINT = 'https://api.serpbase.dev/google/search'
const RESULTS_PER_PAGE = 10
const MAX_DEPTH = 100
const ESTIMATED_REQUEST_COST_MICROS = 500

type ProviderFailureCode =
  | 'configuration'
  | 'authentication'
  | 'budget-limit'
  | 'rate-limit'
  | 'invalid-response'
  | 'remote-error'

type SerpBaseOrganic = {
  rank?: unknown
  position?: unknown
  title?: unknown
  link?: unknown
  url?: unknown
  snippet?: unknown
}

type SerpBaseSuccess = {
  status: 0
  request_id: string
  credits_charged: number
  query: string
  page: number
  organic: SerpBaseOrganic[]
  [key: string]: unknown
}

function failure(code: ProviderFailureCode, message: string): Error {
  const error = new Error(message) as Error & { code?: ProviderFailureCode }
  error.code = code
  return error
}

function apiKey(connection: SeoProviderConnection): string {
  const value = connection.credentials.apiKey?.trim() ?? ''
  if (!value || value.length > 4_096) {
    throw failure('authentication', 'SerpBase needs a valid API key.')
  }
  return value
}

function keyword(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, ' ')
  if (
    !normalized ||
    normalized.length > 80 ||
    normalized.split(/\s+/u).length > 10
  ) {
    throw failure(
      'configuration',
      'SERP snapshots require a keyword of at most 80 characters and 10 words.',
    )
  }
  return normalized
}

function market(
  value: SeoSearchMarket,
): Required<
  Pick<SeoSearchMarket, 'searchEngine' | 'countryCode' | 'languageCode'>
> & { device: 'desktop' | 'mobile' } {
  if (value.searchEngine !== 'google') {
    throw failure(
      'configuration',
      'SerpBase SERP snapshots currently support Google.',
    )
  }
  if (value.location) {
    throw failure(
      'configuration',
      'SerpBase Search supports country-level markets. Omit the canonical location.',
    )
  }
  if (!/^[A-Z]{2}$/u.test(value.countryCode)) {
    throw failure(
      'configuration',
      'SerpBase Search requires a two-letter uppercase country code.',
    )
  }
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/u.test(value.languageCode)) {
    throw failure(
      'configuration',
      'SerpBase Search requires a valid lowercase language code.',
    )
  }
  return {
    searchEngine: 'google',
    countryCode: value.countryCode,
    languageCode: value.languageCode,
    device: value.device ?? 'desktop',
  }
}

function depth(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_DEPTH) {
    throw failure(
      'configuration',
      `SerpBase SERP depth must be from 1 to ${MAX_DEPTH}.`,
    )
  }
  return value
}

function errorCode(status: number): ProviderFailureCode {
  if (status === 1000) return 'configuration'
  if (status === 1001) return 'authentication'
  if (status === 1020) return 'budget-limit'
  if (status === 1029) return 'rate-limit'
  return 'remote-error'
}

function response(value: unknown, requestedPage: number): SerpBaseSuccess {
  if (typeof value !== 'object' || value === null) {
    throw failure('invalid-response', 'SerpBase returned invalid data.')
  }
  const row = value as Record<string, unknown>
  if (row.status !== 0) {
    const status =
      typeof row.status === 'number' && Number.isSafeInteger(row.status)
        ? row.status
        : 1500
    const detail =
      typeof row.error === 'string' ? row.error.slice(0, 500) : 'remote error'
    throw failure(
      errorCode(status),
      `SerpBase could not complete the search (${status}: ${detail}).`,
    )
  }
  if (
    typeof row.request_id !== 'string' ||
    !row.request_id.trim() ||
    row.request_id.length > 100 ||
    typeof row.query !== 'string' ||
    row.query.length > 1_000 ||
    row.page !== requestedPage ||
    typeof row.credits_charged !== 'number' ||
    !Number.isSafeInteger(row.credits_charged) ||
    row.credits_charged < 0 ||
    (row.organic !== undefined && !Array.isArray(row.organic)) ||
    (Array.isArray(row.organic) && row.organic.length > 100)
  ) {
    throw failure('invalid-response', 'SerpBase returned invalid data.')
  }
  return {
    ...row,
    status: 0,
    request_id: row.request_id,
    credits_charged: row.credits_charged,
    query: row.query,
    page: requestedPage,
    organic: (row.organic ?? []) as SerpBaseOrganic[],
  }
}

async function searchPage(input: {
  connection: SeoProviderConnection
  runtime: SeoProviderRuntime
  keyword: string
  market: ReturnType<typeof market>
  page: number
}): Promise<{ response: SerpBaseSuccess; observedAt: string }> {
  const result = response(
    await input.runtime.requestJson({
      operation: 'serp-snapshot',
      url: SEARCH_ENDPOINT,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey(input.connection),
        'x-serpbase-source': 'seo',
      },
      body: JSON.stringify({
        q: input.keyword,
        hl: input.market.languageCode,
        gl: input.market.countryCode.toLowerCase(),
        page: input.page,
        device: input.market.device === 'desktop' ? 'pc' : 'mobile',
      }),
    }),
    input.page,
  )
  return { response: result, observedAt: input.runtime.now() }
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    parsed.username = ''
    parsed.password = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function organicResult(
  item: SerpBaseOrganic,
  page: number,
): SeoSerpOrganicResult | null {
  const url = safeUrl(item.url ?? item.link)
  const rank =
    typeof item.rank === 'number'
      ? item.rank
      : typeof item.position === 'number'
        ? item.position
        : null
  if (!url || !Number.isSafeInteger(rank) || (rank ?? 0) < 1) return null
  return {
    rankGroup: rank as number,
    rankAbsolute: (page - 1) * RESULTS_PER_PAGE + (rank as number),
    page,
    domain: new URL(url).hostname.toLowerCase(),
    url,
    title:
      typeof item.title === 'string' && item.title.length <= 10_000
        ? item.title.trim() || null
        : null,
    description:
      typeof item.snippet === 'string' && item.snippet.length <= 50_000
        ? item.snippet.trim() || null
        : null,
    isFeaturedSnippet: null,
  }
}

function featureNames(response: SerpBaseSuccess): string[] {
  const present = (value: unknown): boolean => {
    if (value === undefined || value === null) return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'string') return value.trim().length > 0
    if (typeof value === 'object') return Object.keys(value).length > 0
    return true
  }
  const names = [
    'featured_snippet',
    'top_stories',
    'people_also_ask',
    'knowledge_graph',
    'related_searches',
    'ai_overview',
    'weather',
    'finance',
    'flight',
    'result_stats',
  ].filter((key) => present(response[key]))
  if (response.organic.length > 0) names.push('organic')
  return names.sort()
}

async function verify(
  connection: SeoProviderConnection,
  runtime: SeoProviderRuntime,
): Promise<void> {
  await searchPage({
    connection,
    runtime,
    keyword: 'serpbase connection check',
    market: {
      searchEngine: 'google',
      countryCode: 'US',
      languageCode: 'en',
      device: 'desktop',
    },
    page: 1,
  })
}

async function serpSnapshot(
  input: SeoProviderConnection & {
    keyword: string
    market: SeoSearchMarket
    depth: number
  },
  runtime: SeoProviderRuntime,
): Promise<SeoSerpSnapshotResult> {
  const normalizedKeyword = keyword(input.keyword)
  const normalizedMarket = market(input.market)
  const requestedDepth = depth(input.depth)
  const requestedPages = Math.ceil(requestedDepth / RESULTS_PER_PAGE)
  const pages: Array<Awaited<ReturnType<typeof searchPage>>> = []
  let failedPage: number | null = null
  for (let page = 1; page <= requestedPages; page += 1) {
    try {
      pages.push(
        await searchPage({
          connection: input,
          runtime,
          keyword: normalizedKeyword,
          market: normalizedMarket,
          page,
        }),
      )
    } catch (error) {
      if (page === 1) throw error
      failedPage = page
      break
    }
  }
  const first = pages[0]
  if (!first) {
    throw failure('invalid-response', 'SerpBase returned no result pages.')
  }
  const raw = pages.flatMap((page) =>
    page.response.organic.map((item) => ({ item, page: page.response.page })),
  )
  const mapped = raw
    .flatMap(({ item, page }) => {
      const result = organicResult(item, page)
      return result ? [result] : []
    })
    .sort(
      (left, right) =>
        left.rankAbsolute - right.rankAbsolute ||
        (left.url < right.url ? -1 : left.url > right.url ? 1 : 0),
    )
  const organicResults = mapped.slice(0, requestedDepth)
  const invalidRows = raw.length - mapped.length
  const capped = mapped.length > requestedDepth
  const qualityWarnings: SeoSerpSnapshotResult['qualityWarnings'][number][] = []
  if (invalidRows > 0) {
    qualityWarnings.push({
      code: 'invalid-organic-results',
      field: 'organicResults',
      message: `SerpBase returned ${invalidRows} organic result${invalidRows === 1 ? '' : 's'} without a valid rank or URL.`,
    })
  }
  if (pages.some((page) => page.response.credits_charged > 0)) {
    qualityWarnings.push({
      code: 'estimated-monetary-cost',
      field: 'cost.actualMicros',
      message:
        'SerpBase reported charged credits but not the account-specific monetary value. The local ledger retained the conservative request estimate.',
    })
  }
  if (requestedPages > 1) {
    qualityWarnings.push({
      code: 'page-offset-rank',
      field: 'organicResults.rankAbsolute',
      message:
        'Positions after page one use the requested page and SerpBase page-relative rank, with 10 organic positions per page.',
    })
  }
  if (failedPage !== null) {
    qualityWarnings.push({
      code: 'page-fetch-failed',
      field: 'organicResults',
      message: `SerpBase page ${failedPage} could not be collected. Results from earlier pages were retained.`,
    })
  }
  const actualUnits = pages.reduce(
    (total, page) => total + page.response.credits_charged,
    0,
  )
  return {
    observedAt: pages.at(-1)?.observedAt ?? first.observedAt,
    effectiveKeyword:
      first.response.query.trim().replace(/\s+/gu, ' ') || normalizedKeyword,
    searchEngineDomain: null,
    checkUrl: null,
    resultCount: null,
    pagesCount: pages.length,
    features: [
      ...new Set(pages.flatMap((page) => featureNames(page.response))),
    ].sort(),
    organicResults,
    localPack: {
      present: false,
      returnedRows: 0,
      retainedRows: 0,
      invalidRows: 0,
      results: [],
    },
    coverage: {
      returnedRows: raw.length,
      retainedRows: organicResults.length,
      invalidRows,
      providerTotalRows: null,
      completeness:
        failedPage !== null || invalidRows > 0
          ? 'partial'
          : capped
            ? 'capped'
            : 'complete',
      nextCursor: failedPage === null ? null : String(failedPage),
    },
    request: {
      endpoint: 'google/search',
      filters: {
        countryCode: normalizedMarket.countryCode,
        languageCode: normalizedMarket.languageCode,
        device: normalizedMarket.device,
        pagesRequested: requestedPages,
        pagesCollected: pages.length,
      },
      sort: ['rankAbsolute:ascending', 'url:codepoint-ascending'],
    },
    cost: {
      estimatedMicros: pages.length * ESTIMATED_REQUEST_COST_MICROS,
      actualMicros: actualUnits === 0 ? 0 : null,
      taskIds: pages.map((page) => page.response.request_id).sort(),
      native: {
        unit: 'credit',
        estimatedUnits: pages.length,
        actualUnits,
        remainingBefore: null,
      },
    },
    qualityWarnings,
  }
}

const activate: SeoProviderActivate = (host) => {
  host.registerProvider({
    id: 'serpbase',
    displayName: 'SerpBase',
    description: 'Add live Google result snapshots from SerpBase.',
    kinds: ['search-results'],
    connection: {
      fields: [
        {
          id: 'apiKey',
          label: 'API key',
          kind: 'secret',
          required: true,
          envVar: 'SEO_SERPBASE_API_KEY',
        },
      ],
      verify,
      verificationNotice:
        'Connection verification runs one billed Google Search request.',
    },
    capabilities: [
      {
        id: 'serp-snapshot',
        defaultDepth: 10,
        maxDepth: MAX_DEPTH,
        maxRequests: 10,
        markets: [
          {
            searchEngines: ['google'],
            devices: ['desktop', 'mobile'],
            location: 'country-only',
          },
        ],
        estimateCostMicros: ({ depth: requestedDepth }) =>
          Math.ceil(depth(requestedDepth) / RESULTS_PER_PAGE) *
          ESTIMATED_REQUEST_COST_MICROS,
        estimateRequests: ({ depth: requestedDepth }) =>
          Math.ceil(depth(requestedDepth) / RESULTS_PER_PAGE),
        run: serpSnapshot,
      },
    ],
  })
}

export default activate
