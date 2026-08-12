import { describe, expect, it } from 'vitest'
import { observePage } from '../../src/context/observePage.js'
import type { PageLike } from '../../src/context/ContextPage.js'
import { createUid } from '../../src/uid.js'

interface CdpCall {
  session: string
  method: string
  params: unknown
}

function pageWithCdp(
  handler: (call: CdpCall) => unknown,
  image = 'data:image/png;base64,img',
): PageLike {
  return {
    accessibility: { snapshot: async () => ({}) },
    cdp: async (session, method, params) => handler({ session, method, params }),
    screenshot: async () => image,
    evaluate: async () => undefined,
    goto: async () => undefined,
    keyboardPress: async () => undefined,
  }
}

const axTree = {
  nodes: [
    {
      nodeId: '1',
      ignored: false,
      role: { value: 'button' },
      name: { value: 'Go' },
      backendDOMNodeId: 42,
    },
  ],
}

const frameTree = {
  frameTree: { frame: { loaderId: 'loader-9', url: 'https://example.com' } },
}

const boxModel = {
  model: { content: [10, 20, 90, 20, 90, 44, 10, 44] },
}

describe('observePage', () => {
  it('builds a snapshot, overlay, and image from CDP + screenshot', async () => {
    const calls: string[] = []
    const page = pageWithCdp((call) => {
      calls.push(call.method)
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        return boxModel
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.image).toBe('data:image/png;base64,img')
    expect(result.snapshot.uid).toBe(createUid('loader-9', 42))
    expect(result.snapshot.role).toBe('button')
    expect(result.snapshot.name).toBe('Go')
    expect(result.overlay[createUid('loader-9', 42)]).toEqual({
      x: 10,
      y: 20,
      width: 80,
      height: 24,
    })
    expect(calls).toContain('Accessibility.getFullAXTree')
    expect(calls).toContain('Page.getFrameTree')
    expect(calls).toContain('DOM.getBoxModel')
  })

  it('omits overlay entries when getBoxModel fails', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        throw new Error('no box')
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.snapshot.uid).toBe(createUid('loader-9', 42))
    expect(result.overlay).toEqual({})
  })

  it('uses no-loader when the frame tree has no loaderId', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return {}
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.snapshot.uid).toBe(createUid('no-loader', 42))
  })

  it('uses no-loader when loaderId is not a string', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return { frameTree: { frame: { loaderId: 99 } } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.snapshot.uid).toBe(createUid('no-loader', 42))
  })

  it('drops a childIds list that contains no strings', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return {
          nodes: [
            {
              nodeId: '1',
              ignored: false,
              role: { value: 'generic' },
              name: { value: 'root' },
              backendDOMNodeId: 1,
              childIds: [1, 2],
            },
          ],
        }
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.snapshot.children).toBeUndefined()
  })

  it('builds an empty-root snapshot when the ax tree is missing', async () => {
    const page = pageWithCdp(() => ({}))
    const result = await observePage(page)
    expect(result.snapshot.role).toBe('generic')
    expect(result.image).toBe('data:image/png;base64,img')
  })

  it('connects children and skips invalid or ignored nodes', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return {
          nodes: [
            {
              nodeId: '1',
              ignored: false,
              role: { value: 'generic' },
              name: { value: 'root' },
              backendDOMNodeId: 1,
              childIds: ['2', '3', 99],
            },
            'not-a-node',
            {
              nodeId: '2',
              ignored: true,
              backendDOMNodeId: 2,
            },
            {
              nodeId: '3',
              ignored: false,
              role: { value: 'textbox' },
              name: { value: 'Field' },
              value: { value: 'typed' },
              backendDOMNodeId: 3,
            },
            { ignored: false },
          ],
        }
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.snapshot.children).toHaveLength(1)
    expect(result.snapshot.children?.[0]?.role).toBe('textbox')
    expect(result.snapshot.children?.[0]?.value).toBe('typed')
  })

  it('skips nodes without a backendDOMNodeId when collecting boxes', async () => {
    const methods: string[] = []
    const page = pageWithCdp((call) => {
      methods.push(call.method)
      if (call.method === 'Accessibility.getFullAXTree') {
        return {
          nodes: [
            { nodeId: '1', ignored: false, role: { value: 'generic' }, name: { value: 'x' } },
          ],
        }
      }
      return {}
    })
    await observePage(page)
    expect(methods).not.toContain('DOM.getBoxModel')
  })

  it('computes a box when the first quad point is the max corner', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        return { model: { content: [90, 44, 10, 20, 90, 20, 10, 44] } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.overlay[createUid('loader-9', 42)]).toEqual({
      x: 10,
      y: 20,
      width: 80,
      height: 24,
    })
  })

  it('ignores a box model that is not a number quad', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        return { model: { content: ['x', 'y'] } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.overlay).toEqual({})
  })
})
