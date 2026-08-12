import { describe, expect, it } from 'vitest'
import {
  clickUid,
  hoverUid,
  navigateTo,
  pressKey,
  scrollUid,
  selectUid,
  typeUid,
} from '../../src/context/actOnPage.js'
import type { PageLike } from '../../src/context/ContextPage.js'

interface CdpCall {
  session: string
  method: string
  params: unknown
}

function recordingPage(): PageLike & {
  cdpCalls: CdpCall[]
  evals: unknown[]
  gotos: string[]
  keys: string[]
} {
  const cdpCalls: CdpCall[] = []
  const evals: unknown[] = []
  const gotos: string[] = []
  const keys: string[] = []
  return {
    cdpCalls,
    evals,
    gotos,
    keys,
    accessibility: { snapshot: async () => ({}) },
    cdp: async (session, method, params) => {
      cdpCalls.push({ session, method, params })
      if (method === 'DOM.resolveNode') {
        return { object: { objectId: 'obj-1' } }
      }
      return {}
    },
    screenshot: async () => '',
    evaluate: async (fn, arg) => {
      evals.push({ fn, arg })
      return undefined
    },
    goto: async (url) => {
      gotos.push(url)
    },
    keyboardPress: async (key) => {
      keys.push(key)
    },
  }
}

describe('actOnPage', () => {
  it('click resolves the uid and calls Runtime.callFunctionOn', async () => {
    const page = recordingPage()
    await clickUid(page, 'loader-1_42')
    expect(page.cdpCalls).toContainEqual({
      session: 'page',
      method: 'DOM.resolveNode',
      params: { backendNodeId: 42 },
    })
    const call = page.cdpCalls.find((c) => c.method === 'Runtime.callFunctionOn')
    expect(call?.params).toEqual({
      objectId: 'obj-1',
      functionDeclaration: 'function() { this.click(); }',
    })
  })

  it('type focuses the node and inserts text', async () => {
    const page = recordingPage()
    await typeUid(page, 'loader-1_42', 'hi')
    expect(page.cdpCalls.some((c) => c.method === 'DOM.resolveNode')).toBe(true)
    expect(page.cdpCalls.some((c) => c.method === 'Runtime.callFunctionOn')).toBe(true)
    expect(JSON.stringify(page.cdpCalls)).toMatch(/hi/)
  })

  it('hover, scroll, and select dispatch through callFunctionOn', async () => {
    const page = recordingPage()
    await hoverUid(page, 'loader-1_42')
    await scrollUid(page, 'loader-1_42', 1, 2)
    await selectUid(page, 'loader-1_42', 'opt')
    const fns = page.cdpCalls
      .filter((c) => c.method === 'Runtime.callFunctionOn')
      .map((c) => JSON.stringify(c.params))
    expect(fns.some((fn) => fn.includes('mouseover') || fn.includes('hover'))).toBe(true)
    expect(fns.some((fn) => fn.includes('scrollBy') || fn.includes('scroll'))).toBe(true)
    expect(fns.some((fn) => fn.includes('opt'))).toBe(true)
  })

  it('press uses keyboardPress and navigate uses goto', async () => {
    const page = recordingPage()
    await pressKey(page, 'Enter')
    await navigateTo(page, 'https://example.com')
    expect(page.keys).toEqual(['Enter'])
    expect(page.gotos).toEqual(['https://example.com'])
  })

  it('throws on an invalid uid', async () => {
    const page = recordingPage()
    await expect(clickUid(page, 'nope')).rejects.toThrow(/invalid uid/i)
    await expect(typeUid(page, 'nope', 'x')).rejects.toThrow(/invalid uid/i)
    await expect(hoverUid(page, 'nope')).rejects.toThrow(/invalid uid/i)
    await expect(scrollUid(page, 'nope', 0, 0)).rejects.toThrow(/invalid uid/i)
    await expect(selectUid(page, 'nope', 'v')).rejects.toThrow(/invalid uid/i)
  })

  it('throws when resolveNode does not return an objectId', async () => {
    const page = recordingPage()
    page.cdp = async () => ({})
    await expect(clickUid(page, 'loader-1_42')).rejects.toThrow(/resolve/i)
  })

  it('throws when resolveNode is null or objectId is not a string', async () => {
    const payloads: unknown[] = [
      null,
      { object: null },
      { object: {} },
      { object: { objectId: 1 } },
    ]
    for (const resolved of payloads) {
      const page = recordingPage()
      page.cdp = async (session, method, params) => {
        page.cdpCalls.push({ session, method, params })
        return resolved
      }
      await expect(clickUid(page, 'loader-1_42')).rejects.toThrow('Failed to resolve element')
      expect(page.cdpCalls).toEqual([
        { session: 'page', method: 'DOM.resolveNode', params: { backendNodeId: 42 } },
      ])
    }
  })

  it('sends both CDP calls on the page session', async () => {
    const page = recordingPage()
    await clickUid(page, 'loader-1_42')
    expect(page.cdpCalls.map((call) => call.session)).toEqual(['page', 'page'])
    expect(page.cdpCalls[0]).toEqual({
      session: 'page',
      method: 'DOM.resolveNode',
      params: { backendNodeId: 42 },
    })
    expect(page.cdpCalls[1]?.session).toBe('page')
    expect(page.cdpCalls[1]?.method).toBe('Runtime.callFunctionOn')
  })
})
