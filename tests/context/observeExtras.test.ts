import { describe, expect, it } from 'vitest'
import type { PageLike } from '../../src/context/ContextPage.js'
import {
  collectZIndexes,
  enableAccessibility,
  readPageState,
} from '../../src/context/observeExtras.js'

interface EvalCall {
  fn: string
  arg: unknown
}

interface CdpCall {
  session: string
  method: string
  params: unknown
}

function fakePage(options: {
  cdpResult?: unknown
  evaluateResult?: unknown
}): PageLike & { cdpCalls: CdpCall[]; evalCalls: EvalCall[] } {
  const cdpCalls: CdpCall[] = []
  const evalCalls: EvalCall[] = []
  return {
    cdpCalls,
    evalCalls,
    accessibility: { snapshot: async () => ({}) },
    cdp: async (session, method, params) => {
      cdpCalls.push({ session, method, params })
      return options.cdpResult
    },
    screenshot: async () => '',
    evaluate: async (fn, arg) => {
      evalCalls.push({ fn, arg })
      return options.evaluateResult
    },
    goto: async () => undefined,
    keyboardPress: async () => undefined,
  }
}

describe('enableAccessibility', () => {
  it('enables the Accessibility domain on the page session', async () => {
    const page = fakePage({})
    const result = await enableAccessibility(page)
    expect(result).toBeUndefined()
    expect(page.cdpCalls).toEqual([
      { session: 'page', method: 'Accessibility.enable', params: undefined },
    ])
    expect(page.evalCalls).toEqual([])
  })
})

describe('readPageState', () => {
  it('evaluates location.href and document.title and returns both strings', async () => {
    const page = fakePage({
      evaluateResult: { url: 'https://example.com/', title: 'Example' },
    })
    const state = await readPageState(page)
    expect(state).toEqual({ url: 'https://example.com/', title: 'Example' })
    expect(page.evalCalls).toHaveLength(1)
    expect(page.evalCalls[0]?.fn).toMatch(/location\.href/)
    expect(page.evalCalls[0]?.fn).toMatch(/document\.title/)
    expect(page.evalCalls[0]?.arg).toBeUndefined()
  })

  it('accepts empty-string url and title because they are still strings', async () => {
    const page = fakePage({ evaluateResult: { url: '', title: '' } })
    expect(await readPageState(page)).toEqual({ url: '', title: '' })
  })

  it('returns empty strings when evaluate is not a record with string url and title', async () => {
    const cases: unknown[] = [
      null,
      undefined,
      1,
      'page',
      true,
      [],
      {},
      { url: 'https://example.com/' },
      { title: 'Example' },
      { url: 1, title: 'Example' },
      { url: 'https://example.com/', title: 1 },
      { url: null, title: 'Example' },
      { url: 'https://example.com/', title: null },
    ]
    for (const evaluateResult of cases) {
      const page = fakePage({ evaluateResult })
      expect(await readPageState(page)).toEqual({ url: '', title: '' })
    }
  })
})

describe('collectZIndexes', () => {
  it('returns an empty map and does not evaluate when there are no ids', async () => {
    const page = fakePage({ evaluateResult: [{ id: 1, z: 9 }] })
    const result = await collectZIndexes(page, [])
    expect(result.size).toBe(0)
    expect([...result.entries()]).toEqual([])
    expect(page.evalCalls).toEqual([])
  })

  it('evaluates the ids once and maps numeric id/z pairs from an array', async () => {
    const ids = [10, 20, 30]
    const page = fakePage({
      evaluateResult: [
        { id: 10, z: 1 },
        { id: 20, z: 0 },
        { id: 30, z: -1 },
      ],
    })
    const result = await collectZIndexes(page, ids)
    expect(page.evalCalls).toHaveLength(1)
    expect(typeof page.evalCalls[0]?.fn).toBe('string')
    expect(page.evalCalls[0]?.fn.length).toBeGreaterThan(0)
    expect(page.evalCalls[0]?.fn).toMatch(/getComputedStyle|zIndex|z-index/)
    expect(page.evalCalls[0]?.arg).toEqual(ids)
    expect([...result.entries()]).toEqual([
      [10, 1],
      [20, 0],
      [30, -1],
    ])
  })

  it('maps a record of id-string keys to numeric z values', async () => {
    const page = fakePage({
      evaluateResult: { '4': 2, '8': 7 },
    })
    const result = await collectZIndexes(page, [4, 8])
    expect(result.get(4)).toBe(2)
    expect(result.get(8)).toBe(7)
    expect(result.size).toBe(2)
  })

  it('skips non-numeric z values and invalid array entries', async () => {
    const page = fakePage({
      evaluateResult: [
        { id: 1, z: 5 },
        { id: 2, z: 'auto' },
        { id: 3, z: Number.NaN },
        { id: 4, z: Number.POSITIVE_INFINITY },
        { id: '5', z: 1 },
        { z: 2 },
        { id: 6 },
        null,
        'nope',
        { id: 7, z: 9 },
        { id: 0, z: 3 },
      ],
    })
    const result = await collectZIndexes(page, [1, 2, 3, 4, 5, 6, 7, 0])
    expect([...result.entries()]).toEqual([
      [1, 5],
      [7, 9],
      [0, 3],
    ])
  })

  it('skips non-numeric record values and non-numeric keys', async () => {
    const page = fakePage({
      evaluateResult: { '1': 3, two: 4, '3': 'auto', '4': null, '': 8 },
    })
    const result = await collectZIndexes(page, [1, 2, 3, 4])
    expect([...result.entries()]).toEqual([[1, 3]])
  })

  it('returns an empty map when evaluate is not an array or record map', async () => {
    const cases: unknown[] = [null, undefined, 1, 'nope', true]
    for (const evaluateResult of cases) {
      const page = fakePage({ evaluateResult })
      const result = await collectZIndexes(page, [1])
      expect(result.size).toBe(0)
      expect(page.evalCalls).toHaveLength(1)
    }
  })

  it('returns an empty map when evaluate yields an empty array', async () => {
    const page = fakePage({ evaluateResult: [] })
    const result = await collectZIndexes(page, [1])
    expect(result.size).toBe(0)
    expect(page.evalCalls).toHaveLength(1)
  })

  it('last write wins when the same id appears twice', async () => {
    const page = fakePage({
      evaluateResult: [
        { id: 1, z: 1 },
        { id: 1, z: 9 },
      ],
    })
    const result = await collectZIndexes(page, [1])
    expect(result.get(1)).toBe(9)
    expect(result.size).toBe(1)
  })
})
