import { describe, expect, it } from 'vitest'
import {
  axNodesFrom,
  boxFromModel,
  collectBoxes,
  observePage,
  parseAxNode,
} from '../../src/context/observePage.js'
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
): PageLike & { calls: CdpCall[] } {
  const calls: CdpCall[] = []
  return {
    calls,
    accessibility: { snapshot: async () => ({}) },
    cdp: async (session, method, params) => {
      const call = { session, method, params }
      calls.push(call)
      return handler(call)
    },
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
    expect(result.snapshot).toEqual({
      uid: createUid('loader-9', 42),
      role: 'button',
      name: 'Go',
      boundingBox: { x: 10, y: 20, width: 80, height: 24 },
    })
    expect(result.snapshot.children).toBeUndefined()
    expect(result.overlay).toEqual({
      [createUid('loader-9', 42)]: { x: 10, y: 20, width: 80, height: 24 },
    })
    expect(calls).toContain('Accessibility.enable')
    expect(calls).toContain('Accessibility.getFullAXTree')
    expect(calls).toContain('Page.getFrameTree')
    expect(calls).toContain('DOM.getBoxModel')
    expect(page.calls.every((call) => call.session === 'page')).toBe(true)
    expect(page.calls.find((call) => call.method === 'DOM.getBoxModel')?.params).toEqual({
      backendNodeId: 42,
    })
    expect(result.pageState).toEqual({ url: '', title: '' })
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
    expect(result.snapshot).toEqual({
      uid: createUid('loader-9', 1),
      role: 'generic',
      name: 'root',
      children: [
        {
          uid: createUid('loader-9', 3),
          role: 'textbox',
          name: 'Field',
          value: 'typed',
        },
      ],
    })
    expect(result.snapshot.children).toHaveLength(1)
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

  it('drops ax nodes that are not records with a string nodeId', async () => {
    const payloads: unknown[] = [
      null,
      {},
      { nodes: 1 },
      { nodes: [1] },
      { nodes: [null] },
      { nodes: [{ role: { value: 'button' }, name: { value: 'Nope' } }] },
      { nodes: [{ nodeId: 5, role: { value: 'button' }, name: { value: 'Nope' } }] },
    ]
    for (const ax of payloads) {
      const page = pageWithCdp((call) => {
        if (call.method === 'Accessibility.getFullAXTree') {
          return ax
        }
        if (call.method === 'Page.getFrameTree') {
          return frameTree
        }
        return {}
      })
      const result = await observePage(page)
      expect(result.snapshot).toEqual({
        uid: createUid('loader-9', 0),
        role: 'generic',
        name: '',
      })
    }
  })

  it('ignores role, name, and value bags that are not { value: string }', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return {
          nodes: [
            {
              nodeId: '1',
              ignored: false,
              role: { value: 99 },
              name: { value: false },
              value: { value: 2 },
              backendDOMNodeId: 1,
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
    expect(result.snapshot).toEqual({
      uid: createUid('loader-9', 1),
      role: 'generic',
      name: '',
    })
    expect(result.snapshot).not.toHaveProperty('value')
  })

  it('ignores a null role bag without throwing', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return {
          nodes: [
            {
              nodeId: '1',
              ignored: false,
              role: null,
              name: null,
              value: null,
              backendDOMNodeId: 1,
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
    expect(result.snapshot).toEqual({
      uid: createUid('loader-9', 1),
      role: 'generic',
      name: '',
    })
  })

  it('treats a non-number backendDOMNodeId as missing', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return {
          nodes: [
            {
              nodeId: '1',
              ignored: false,
              role: { value: 'generic' },
              name: { value: 'x' },
              backendDOMNodeId: '42',
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
    expect(result.snapshot).toEqual({
      uid: createUid('loader-9', 0),
      role: 'generic',
      name: 'x',
    })
    expect(page.calls.some((call) => call.method === 'DOM.getBoxModel')).toBe(false)
    expect(page.calls.some((call) => call.method === 'DOM.resolveNode')).toBe(false)
  })

  it('does not invent child ids when the list is empty or non-strings', async () => {
    const childIdLists: unknown[] = [[], [1, 2], [null], [true]]
    for (const childIds of childIdLists) {
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
                childIds,
              },
              {
                nodeId: 'Stryker was here',
                ignored: false,
                role: { value: 'button' },
                name: { value: 'Injected' },
                backendDOMNodeId: 99,
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
      expect(result.snapshot).toEqual({
        uid: createUid('loader-9', 1),
        role: 'generic',
        name: 'root',
      })
      expect(result.snapshot.children).toBeUndefined()
    }
  })

  it('uses no-loader when loaderId is an array rather than a string', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return { frameTree: { frame: { loaderId: ['evil'] } } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.snapshot.uid).toBe(createUid('no-loader', 42))
    expect(result.snapshot.uid).not.toBe('evil_42')
  })

  it('ignores box models that are not a record with a numeric content quad', async () => {
    const payloads: unknown[] = [
      null,
      {},
      { model: null },
      { model: {} },
      { model: { content: 1 } },
      { model: { content: 'x' } },
    ]
    for (const model of payloads) {
      const page = pageWithCdp((call) => {
        if (call.method === 'Accessibility.getFullAXTree') {
          return axTree
        }
        if (call.method === 'Page.getFrameTree') {
          return frameTree
        }
        if (call.method === 'DOM.getBoxModel') {
          return model
        }
        return {}
      })
      const result = await observePage(page)
      expect(result.overlay).toEqual({})
      expect(result.snapshot).not.toHaveProperty('boundingBox')
    }
  })

  it('pairs box-model coordinates as (x, y) and keeps the true min/max', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        return { model: { content: [5, 15, 25, 35] } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.overlay[createUid('loader-9', 42)]).toEqual({
      x: 5,
      y: 15,
      width: 20,
      height: 20,
    })
  })

  it('uses the first x as min when it is smaller than the last x', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        return { model: { content: [10, 0, 90, 100] } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.overlay[createUid('loader-9', 42)]).toEqual({
      x: 10,
      y: 0,
      width: 80,
      height: 100,
    })
  })

  it('uses the first x as max when it is larger than the last x', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        return { model: { content: [10, 0, 5, 100] } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.overlay[createUid('loader-9', 42)]).toEqual({
      x: 5,
      y: 0,
      width: 5,
      height: 100,
    })
  })

  it('uses the first y as min when it is smaller than the last y', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        return { model: { content: [0, 10, 1, 90] } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.overlay[createUid('loader-9', 42)]).toEqual({
      x: 0,
      y: 10,
      width: 1,
      height: 80,
    })
  })

  it('uses the first y as max when it is larger than the last y', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        return { model: { content: [0, 10, 1, 5] } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.overlay[createUid('loader-9', 42)]).toEqual({
      x: 0,
      y: 5,
      width: 1,
      height: 5,
    })
  })

  it('skips a content pair unless both x and y are numbers', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        return { model: { content: ['nope', 20, 10, 40] } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.overlay[createUid('loader-9', 42)]).toEqual({
      x: 10,
      y: 40,
      width: 0,
      height: 0,
    })
  })

  it('skips a content pair when y is not a number', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return axTree
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        return { model: { content: [10, 'nope', 30, 40] } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.overlay[createUid('loader-9', 42)]).toEqual({
      x: 30,
      y: 40,
      width: 0,
      height: 0,
    })
  })

  it('attaches z-index only for nodes with a numeric backendDOMNodeId', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'Accessibility.getFullAXTree') {
        return {
          nodes: [
            {
              nodeId: '1',
              ignored: false,
              role: { value: 'generic' },
              name: { value: 'root' },
              backendDOMNodeId: 42,
              childIds: ['2'],
            },
            {
              nodeId: '2',
              ignored: false,
              role: { value: 'button' },
              name: { value: 'Go' },
            },
          ],
        }
      }
      if (call.method === 'Page.getFrameTree') {
        return frameTree
      }
      if (call.method === 'DOM.getBoxModel') {
        return boxModel
      }
      if (call.method === 'DOM.resolveNode') {
        return { object: { objectId: 'obj-42' } }
      }
      if (call.method === 'Runtime.callFunctionOn') {
        return { result: { value: 7 } }
      }
      return {}
    })
    const result = await observePage(page)
    expect(result.snapshot).toEqual({
      uid: createUid('loader-9', 42),
      role: 'generic',
      name: 'root',
      boundingBox: { x: 10, y: 20, width: 80, height: 24 },
      zIndex: 7,
      children: [
        {
          uid: createUid('loader-9', 0),
          role: 'button',
          name: 'Go',
        },
      ],
    })
    expect(result.snapshot.children).toHaveLength(1)
    const resolveIds = page.calls
      .filter((call) => call.method === 'DOM.resolveNode')
      .map((call) => call.params)
    expect(resolveIds).toEqual([{ backendNodeId: 42 }])
    expect(page.calls.every((call) => call.session === 'page')).toBe(true)
  })
})

describe('parseAxNode', () => {
  it('omits childIds unless at least one entry is a string', () => {
    expect(parseAxNode({ nodeId: '1', childIds: [] })?.childIds).toBeUndefined()
    expect(parseAxNode({ nodeId: '1', childIds: [1, 2] })?.childIds).toBeUndefined()
    expect(parseAxNode({ nodeId: '1', childIds: ['2', 3] })?.childIds).toEqual(['2'])
    expect(parseAxNode({ nodeId: '1', childIds: ['2', '3'] })?.childIds).toEqual(['2', '3'])
  })
})

describe('axNodesFrom', () => {
  it('returns an empty array when the payload has no nodes list', () => {
    expect(axNodesFrom({})).toEqual([])
    expect(axNodesFrom(null)).toEqual([])
    expect(axNodesFrom({ nodes: 'nope' })).toEqual([])
  })
})

describe('boxFromModel', () => {
  it('returns undefined without throwing on malformed models', () => {
    const payloads: unknown[] = [null, {}, { model: null }, { model: { content: 1 } }]
    for (const payload of payloads) {
      expect(boxFromModel(payload)).toBeUndefined()
    }
  })

  it('returns undefined when no numeric pairs exist', () => {
    expect(boxFromModel({ model: { content: [] } })).toBeUndefined()
    expect(boxFromModel({ model: { content: ['x', 'y'] } })).toBeUndefined()
    expect(boxFromModel({ model: { content: [10] } })).toBeUndefined()
  })

  it('uses Math min/max of every numeric pair', () => {
    expect(boxFromModel({ model: { content: [10, 20, 90, 44] } })).toEqual({
      x: 10,
      y: 20,
      width: 80,
      height: 24,
    })
  })
})

describe('collectBoxes', () => {
  it('does not store an undefined box when the model is malformed', async () => {
    const page = pageWithCdp((call) => {
      if (call.method === 'DOM.getBoxModel') {
        return { model: { content: ['x'] } }
      }
      return {}
    })
    const boxes = await collectBoxes(page, [{ nodeId: '1', ignored: false, backendDOMNodeId: 42 }])
    expect(boxes.size).toBe(0)
    expect(boxes.has(42)).toBe(false)
  })
})
