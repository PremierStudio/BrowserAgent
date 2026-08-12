import { describe, expect, it } from 'vitest'
import { diffSnapshots } from '../../src/diff/diff.js'
import type { SnapshotNode } from '../../src/snapshot/a11ySnapshot.js'

function node(uid: string, overrides: Partial<SnapshotNode> = {}): SnapshotNode {
  return { uid, role: 'generic', name: '', ...overrides }
}

describe('diffSnapshots', () => {
  it('reports no changes for identical trees', () => {
    const tree = node('a', { children: [node('b')] })
    const result = diffSnapshots(tree, tree)
    expect(result).toEqual({ added: [], removed: [], changed: [] })
  })

  it('reports an added node', () => {
    const oldTree = node('a')
    const newTree = node('a', { children: [node('b')] })
    const result = diffSnapshots(oldTree, newTree)
    expect(result.added).toEqual([{ uid: 'b' }])
    expect(result.removed).toEqual([])
    expect(result.changed).toEqual([])
  })

  it('reports a removed node', () => {
    const oldTree = node('a', { children: [node('b')] })
    const newTree = node('a')
    const result = diffSnapshots(oldTree, newTree)
    expect(result.removed).toEqual([{ uid: 'b' }])
    expect(result.added).toEqual([])
  })

  it('reports a value change on a node', () => {
    const oldTree = node('a', { value: 'old' })
    const newTree = node('a', { value: 'new' })
    const result = diffSnapshots(oldTree, newTree)
    expect(result.changed).toEqual([{ uid: 'a', value: { from: 'old', to: 'new' } }])
  })

  it('reports a value appearing on a node', () => {
    const oldTree = node('a')
    const newTree = node('a', { value: 'new' })
    const result = diffSnapshots(oldTree, newTree)
    expect(result.changed).toEqual([{ uid: 'a', value: { from: '', to: 'new' } }])
  })

  it('reports a value disappearing from a node', () => {
    const oldTree = node('a', { value: 'old' })
    const newTree = node('a')
    const result = diffSnapshots(oldTree, newTree)
    expect(result.changed).toEqual([{ uid: 'a', value: { from: 'old', to: '' } }])
  })

  it('reports a name change on a node', () => {
    const oldTree = node('a', { name: 'Old' })
    const newTree = node('a', { name: 'New' })
    const result = diffSnapshots(oldTree, newTree)
    expect(result.changed).toEqual([{ uid: 'a', name: { from: 'Old', to: 'New' } }])
  })

  it('reports a role change on a node', () => {
    const oldTree = node('a', { role: 'button' })
    const newTree = node('a', { role: 'link' })
    const result = diffSnapshots(oldTree, newTree)
    expect(result.changed).toEqual([{ uid: 'a', role: { from: 'button', to: 'link' } }])
  })

  it('reports a bounding box change on a node', () => {
    const oldTree = node('a', { boundingBox: { x: 0, y: 0, width: 1, height: 1 } })
    const newTree = node('a', { boundingBox: { x: 5, y: 5, width: 1, height: 1 } })
    const result = diffSnapshots(oldTree, newTree)
    expect(result.changed).toEqual([
      {
        uid: 'a',
        boundingBox: {
          from: { x: 0, y: 0, width: 1, height: 1 },
          to: { x: 5, y: 5, width: 1, height: 1 },
        },
      },
    ])
  })

  it('reports a bounding box appearing on a node', () => {
    const oldTree = node('a')
    const newTree = node('a', { boundingBox: { x: 1, y: 1, width: 2, height: 2 } })
    const result = diffSnapshots(oldTree, newTree)
    expect(result.changed).toEqual([
      {
        uid: 'a',
        boundingBox: {
          from: { x: 0, y: 0, width: 0, height: 0 },
          to: { x: 1, y: 1, width: 2, height: 2 },
        },
      },
    ])
  })

  it('reports a bounding box disappearing from a node', () => {
    const oldTree = node('a', { boundingBox: { x: 1, y: 1, width: 2, height: 2 } })
    const newTree = node('a')
    const result = diffSnapshots(oldTree, newTree)
    expect(result.changed).toEqual([
      {
        uid: 'a',
        boundingBox: {
          from: { x: 1, y: 1, width: 2, height: 2 },
          to: { x: 0, y: 0, width: 0, height: 0 },
        },
      },
    ])
  })

  it('does not report a change when only zIndex differs', () => {
    const oldTree = node('a', { zIndex: 1 })
    const newTree = node('a', { zIndex: 2 })
    const result = diffSnapshots(oldTree, newTree)
    expect(result.changed).toEqual([])
  })

  it('reports nested changes recursively', () => {
    const oldTree = node('a', { children: [node('b', { value: 'x' })] })
    const newTree = node('a', { children: [node('b', { value: 'y' })] })
    const result = diffSnapshots(oldTree, newTree)
    expect(result.changed).toEqual([{ uid: 'b', value: { from: 'x', to: 'y' } }])
  })

  it('reports multiple changes in one diff', () => {
    const oldTree = node('a', { children: [node('b'), node('c', { value: 'x' })] })
    const newTree = node('a', { children: [node('b'), node('c', { value: 'y' }), node('d')] })
    const result = diffSnapshots(oldTree, newTree)
    expect(result.added).toEqual([{ uid: 'd' }])
    expect(result.changed).toEqual([{ uid: 'c', value: { from: 'x', to: 'y' } }])
  })

  it('returns a DiffResult with empty arrays for an empty tree', () => {
    const result = diffSnapshots(node('a'), node('a'))
    expect(result).toEqual({ added: [], removed: [], changed: [] })
  })
})
