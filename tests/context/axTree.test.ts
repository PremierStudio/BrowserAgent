import { describe, expect, it } from 'vitest'
import { buildRawTree, type AxNode, type BoxLookup } from '../../src/context/axTree.js'

function axNode(overrides: Partial<AxNode> = {}): AxNode {
  return {
    nodeId: '1',
    ignored: false,
    role: { value: 'generic' },
    name: { value: '' },
    backendDOMNodeId: 1,
    ...overrides,
  }
}

const boxes: BoxLookup = new Map([
  [1, { x: 0, y: 0, width: 10, height: 10 }],
  [2, { x: 1, y: 1, width: 2, height: 2 }],
])

describe('buildRawTree', () => {
  it('builds a root node with role, name and backendDOMNodeId', () => {
    const root = buildRawTree(
      [axNode({ role: { value: 'button' }, name: { value: 'Go' } })],
      boxes,
      'loader-1',
    )
    expect(root.role).toBe('button')
    expect(root.name).toBe('Go')
    expect(root.backendDOMNodeId).toBe(1)
    expect(root.loaderId).toBe('loader-1')
  })

  it('attaches a bounding box when present in the lookup', () => {
    const root = buildRawTree([axNode({ backendDOMNodeId: 1 })], boxes, 'loader-1')
    expect(root.boundingBox).toEqual({ x: 0, y: 0, width: 10, height: 10 })
  })

  it('omits the bounding box when absent from the lookup', () => {
    const root = buildRawTree([axNode({ backendDOMNodeId: 99 })], boxes, 'loader-1')
    expect(root.boundingBox).toBeUndefined()
  })

  it('connects children by childIds', () => {
    const nodes = [
      axNode({ nodeId: '1', backendDOMNodeId: 1, childIds: ['2'] }),
      axNode({
        nodeId: '2',
        role: { value: 'textbox' },
        name: { value: 'Field' },
        backendDOMNodeId: 2,
      }),
    ]
    const root = buildRawTree(nodes, boxes, 'loader-1')
    expect(root.children).toHaveLength(1)
    const child = root.children?.[0]
    expect(child?.role).toBe('textbox')
    expect(child?.name).toBe('Field')
    expect(child?.backendDOMNodeId).toBe(2)
  })

  it('filters out ignored nodes', () => {
    const nodes = [
      axNode({ nodeId: '1', backendDOMNodeId: 1, childIds: ['2'] }),
      axNode({ nodeId: '2', ignored: true, backendDOMNodeId: 2 }),
    ]
    const root = buildRawTree(nodes, boxes, 'loader-1')
    expect(root.children).toBeUndefined()
  })

  it('includes the value when present', () => {
    const root = buildRawTree([axNode({ value: { value: 'hello' } })], boxes, 'loader-1')
    expect(root.value).toBe('hello')
  })

  it('omits the value when absent', () => {
    const root = buildRawTree([axNode({})], boxes, 'loader-1')
    expect(root.value).toBeUndefined()
  })

  it('includes zIndex when present in the lookup', () => {
    const zIndexes = new Map<number, number>([[1, 5]])
    const root = buildRawTree([axNode({ backendDOMNodeId: 1 })], boxes, 'loader-1', zIndexes)
    expect(root.zIndex).toBe(5)
  })

  it('omits zIndex when absent from the lookup', () => {
    const root = buildRawTree([axNode({ backendDOMNodeId: 1 })], boxes, 'loader-1')
    expect(root.zIndex).toBeUndefined()
  })

  it('returns a node with no children when childIds reference missing nodes', () => {
    const root = buildRawTree(
      [axNode({ nodeId: '1', backendDOMNodeId: 1, childIds: ['missing'] })],
      boxes,
      'loader-1',
    )
    expect(root.children).toBeUndefined()
  })

  it('defaults role and name when absent', () => {
    const root = buildRawTree([axNode({ role: undefined, name: undefined })], boxes, 'loader-1')
    expect(root.role).toBe('generic')
    expect(root.name).toBe('')
  })

  it('defaults backendDOMNodeId to 0 when absent', () => {
    const root = buildRawTree([axNode({ backendDOMNodeId: undefined })], boxes, 'loader-1')
    expect(root.backendDOMNodeId).toBe(0)
  })

  it('handles an empty nodes array with a fallback root', () => {
    const root = buildRawTree([], boxes, 'loader-1')
    expect(root.role).toBe('generic')
    expect(root.loaderId).toBe('loader-1')
  })

  it('builds a fallback root when the root node is ignored', () => {
    const root = buildRawTree([axNode({ ignored: true })], boxes, 'loader-1')
    expect(root.role).toBe('generic')
    expect(root.loaderId).toBe('loader-1')
  })
})
