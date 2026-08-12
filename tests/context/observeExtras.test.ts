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
  it('returns an empty map and does not call CDP when there are no ids', async () => {
    const page = fakePage({})
    const result = await collectZIndexes(page, [])
    expect(result.size).toBe(0)
    expect(page.cdpCalls).toEqual([])
    expect(page.evalCalls).toEqual([])
  })

  it('resolves each backend node and reads computed z-index via callFunctionOn', async () => {
    const page = fakePage({})
    const values = new Map<string, unknown>([
      ['obj-10', 1],
      ['obj-20', '0'],
      ['obj-30', -1],
    ])
    page.cdp = async (session, method, params) => {
      page.cdpCalls.push({ session, method, params })
      if (method === 'DOM.resolveNode' && typeof params === 'object' && params !== null) {
        const id = 'backendNodeId' in params ? params.backendNodeId : undefined
        return { object: { objectId: `obj-${String(id)}` } }
      }
      if (method === 'Runtime.callFunctionOn' && typeof params === 'object' && params !== null) {
        const objectId = 'objectId' in params ? params.objectId : undefined
        return { result: { value: values.get(String(objectId)) } }
      }
      return {}
    }
    const result = await collectZIndexes(page, [10, 20, 30])
    expect(page.cdpCalls.some((c) => c.method === 'DOM.resolveNode')).toBe(true)
    expect(page.cdpCalls.some((c) => c.method === 'Runtime.callFunctionOn')).toBe(true)
    expect(JSON.stringify(page.cdpCalls)).toMatch(/getComputedStyle/)
    expect([...result.entries()]).toEqual([
      [10, 1],
      [20, 0],
      [30, -1],
    ])
  })

  it('skips nodes that do not resolve and non-numeric z-index values', async () => {
    const page = fakePage({})
    let n = 0
    page.cdp = async (session, method, params) => {
      page.cdpCalls.push({ session, method, params })
      if (method === 'DOM.resolveNode') {
        n += 1
        if (n === 1) {
          return {}
        }
        return { object: { objectId: `obj-${n}` } }
      }
      if (method === 'Runtime.callFunctionOn') {
        if (n === 2) {
          return { result: { value: 'auto' } }
        }
        if (n === 3) {
          return { result: { value: 7 } }
        }
        return { result: { value: Number.NaN } }
      }
      return {}
    }
    const result = await collectZIndexes(page, [1, 2, 3, 4])
    expect(result.get(3)).toBe(7)
    expect(result.size).toBe(1)
  })

  it('skips a node when callFunctionOn has no numeric result', async () => {
    const page = fakePage({})
    page.cdp = async (_session, method) => {
      if (method === 'DOM.resolveNode') {
        return { object: { objectId: 'obj' } }
      }
      return {}
    }
    expect((await collectZIndexes(page, [1])).size).toBe(0)
  })

  it('skips a node when resolveNode throws', async () => {
    const page = fakePage({})
    page.cdp = async () => {
      throw new Error('detached')
    }
    const result = await collectZIndexes(page, [9])
    expect(result.size).toBe(0)
  })
})
