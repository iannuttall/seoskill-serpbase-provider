import assert from 'node:assert/strict'
import test from 'node:test'
import type { SeoProviderHost, SeoProviderRegistration } from 'seo/provider-sdk'
import activate from './index.js'

async function registration(): Promise<SeoProviderRegistration> {
  let provider: SeoProviderRegistration | undefined
  const host: SeoProviderHost = {
    apiVersion: 1,
    registerProvider(value) {
      provider = value
    },
  }
  await activate(host)
  if (!provider) throw new Error('SerpBase did not register.')
  return provider
}

test('SerpBase registers only the SERP snapshot capability', async () => {
  const provider = await registration()
  assert.equal(provider.id, 'serpbase')
  assert.deepEqual(
    provider.capabilities.map((capability) => capability.id),
    ['serp-snapshot'],
  )
})

test('SerpBase maps live results and cost evidence', async () => {
  const provider = await registration()
  const capability = provider.capabilities.find(
    (item) => item.id === 'serp-snapshot',
  )
  if (capability?.id !== 'serp-snapshot') {
    throw new Error('SERP snapshot capability was not registered.')
  }
  const result = await capability.run(
    {
      account: {},
      credentials: { apiKey: 'fixture-key' },
      keyword: 'blue widgets',
      market: {
        searchEngine: 'google',
        countryCode: 'US',
        languageCode: 'en',
        device: 'desktop',
      },
      depth: 10,
    },
    {
      now: () => '2026-08-13T10:00:00.000Z',
      requestJson: async () => ({
        status: 0,
        request_id: 'request-one',
        credits_charged: 1,
        query: 'blue widgets',
        page: 1,
        organic: [
          {
            rank: 1,
            title: 'Blue Widgets',
            url: 'https://example.com/widgets',
            snippet: 'A result.',
          },
        ],
      }),
    },
  )
  assert.equal(result.organicResults[0]?.rankAbsolute, 1)
  assert.equal(result.cost.native?.actualUnits, 1)
  assert.equal(result.coverage.completeness, 'complete')
})

test('SerpBase retains earlier pages when a later page fails', async () => {
  const provider = await registration()
  const capability = provider.capabilities.find(
    (item) => item.id === 'serp-snapshot',
  )
  if (capability?.id !== 'serp-snapshot') {
    throw new Error('SERP snapshot capability was not registered.')
  }
  let calls = 0
  const result = await capability.run(
    {
      account: {},
      credentials: { apiKey: 'fixture-key' },
      keyword: 'blue widgets',
      market: {
        searchEngine: 'google',
        countryCode: 'US',
        languageCode: 'en',
      },
      depth: 20,
    },
    {
      now: () => '2026-08-13T10:00:00.000Z',
      requestJson: async () => {
        calls += 1
        if (calls === 2) throw new Error('temporary failure')
        return {
          status: 0,
          request_id: 'request-one',
          credits_charged: 1,
          query: 'blue widgets',
          page: 1,
          organic: [
            {
              rank: 1,
              title: 'Blue Widgets',
              url: 'https://example.com/widgets',
            },
          ],
        }
      },
    },
  )
  assert.equal(result.coverage.completeness, 'partial')
  assert.equal(result.coverage.nextCursor, '2')
})
