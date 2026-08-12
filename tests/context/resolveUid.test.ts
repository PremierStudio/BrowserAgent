import { describe, expect, it } from 'vitest'
import { resolveUid } from '../../src/context/resolveUid.js'
import type { PageLike } from '../../src/context/ContextPage.js'

interface CdpCall {
  session: string
  method: string
  params: unknown
}

function pageWithResolve(result: unknown): PageLike & { calls: CdpCall[] } {
  const calls: CdpCall[] = []
  return {
    calls,
    accessibility: { snapshot: async () => ({}) },
    cdp: async (session, method, params) => {
      calls.push({ session, method, params })
      return result
    },
    screenshot: async () => '',
    evaluate: async () => undefined,
    goto: async () => undefined,
    keyboardPress: async () => undefined,
  }
}

describe('resolveUid', () => {
  it('resolves a uid to backendNodeId and objectId via DOM.resolveNode', async () => {
    const page = pageWithResolve({ object: { objectId: 'obj-1' } })
    const resolved = await resolveUid(page, 'loader-1_42')
    expect(resolved).toEqual({
      uid: 'loader-1_42',
      backendNodeId: 42,
      objectId: 'obj-1',
    })
    expect(page.calls).toEqual([
      { session: 'page', method: 'DOM.resolveNode', params: { backendNodeId: 42 } },
    ])
  })

  it('parses a loaderId that itself contains the separator', async () => {
    const page = pageWithResolve({ object: { objectId: 'obj-nested' } })
    const resolved = await resolveUid(page, 'a_b_7')
    expect(resolved.backendNodeId).toBe(7)
    expect(resolved.objectId).toBe('obj-nested')
    expect(page.calls[0]?.params).toEqual({ backendNodeId: 7 })
  })

  it('throws on an invalid uid and does not call CDP', async () => {
    const page = pageWithResolve({ object: { objectId: 'obj-1' } })
    await expect(resolveUid(page, 'nope')).rejects.toThrow(/invalid uid/i)
    await expect(resolveUid(page, '')).rejects.toThrow(/invalid uid/i)
    await expect(resolveUid(page, '_42')).rejects.toThrow(/invalid uid/i)
    expect(page.calls).toEqual([])
  })

  it('throws when resolveNode does not return an objectId', async () => {
    await expect(resolveUid(pageWithResolve({}), 'loader-1_42')).rejects.toThrow(/resolve/i)
    await expect(resolveUid(pageWithResolve(null), 'loader-1_42')).rejects.toThrow(/resolve/i)
    await expect(resolveUid(pageWithResolve({ object: null }), 'loader-1_42')).rejects.toThrow(
      /resolve/i,
    )
    await expect(
      resolveUid(pageWithResolve({ object: { objectId: 9 } }), 'loader-1_42'),
    ).rejects.toThrow(/resolve/i)
  })
})
