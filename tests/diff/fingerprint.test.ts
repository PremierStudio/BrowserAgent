import { describe, expect, it } from 'vitest'
import { fingerprint, rebindUids } from '../../src/diff/fingerprint.js'
import type { SnapshotNode } from '../../src/snapshot/a11ySnapshot.js'

function node(uid: string, overrides: Partial<SnapshotNode> = {}): SnapshotNode {
  return { uid, role: 'generic', name: '', ...overrides }
}

describe('fingerprint', () => {
  it('produces a stable fingerprint for a node', () => {
    const a = fingerprint(node('a', { role: 'button', name: 'Go' }))
    const b = fingerprint(node('b', { role: 'button', name: 'Go' }))
    expect(a).toBe(b)
  })

  it('produces different fingerprints for different roles', () => {
    const a = fingerprint(node('a', { role: 'button', name: 'Go' }))
    const b = fingerprint(node('a', { role: 'link', name: 'Go' }))
    expect(a).not.toBe(b)
  })

  it('produces different fingerprints for different names', () => {
    const a = fingerprint(node('a', { role: 'button', name: 'Go' }))
    const b = fingerprint(node('a', { role: 'button', name: 'Stop' }))
    expect(a).not.toBe(b)
  })

  it('includes the value in the fingerprint', () => {
    const a = fingerprint(node('a', { role: 'textbox', name: 'Field', value: 'x' }))
    const b = fingerprint(node('a', { role: 'textbox', name: 'Field', value: 'y' }))
    expect(a).not.toBe(b)
  })

  it('includes children in the fingerprint', () => {
    const a = fingerprint(node('a', { children: [node('b', { role: 'text', name: 'One' })] }))
    const b = fingerprint(node('a', { children: [node('c', { role: 'text', name: 'Two' })] }))
    expect(a).not.toBe(b)
  })

  it('is deterministic across calls', () => {
    const n = node('a', { role: 'button', name: 'Go', children: [node('b', { role: 'text' })] })
    expect(fingerprint(n)).toBe(fingerprint(n))
  })
})

describe('rebindUids', () => {
  it('returns an empty map when fingerprints match by uid', () => {
    const oldTree = node('a', { role: 'button', name: 'Go' })
    const newTree = node('a', { role: 'button', name: 'Go' })
    const result = rebindUids(oldTree, newTree)
    expect(result).toEqual({})
  })

  it('maps an old uid to a new uid when the fingerprint matches but uid changed', () => {
    const oldTree = node('old-1', { role: 'button', name: 'Go' })
    const newTree = node('new-1', { role: 'button', name: 'Go' })
    const result = rebindUids(oldTree, newTree)
    expect(result).toEqual({ 'old-1': 'new-1' })
  })

  it('does not rebind when fingerprints differ', () => {
    const oldTree = node('old-1', { role: 'button', name: 'Go' })
    const newTree = node('new-1', { role: 'link', name: 'Go' })
    const result = rebindUids(oldTree, newTree)
    expect(result).toEqual({})
  })

  it('rebinds nested nodes recursively', () => {
    const oldTree = node('old-root', {
      children: [node('old-child', { role: 'text', name: 'Hi' })],
    })
    const newTree = node('new-root', {
      children: [node('new-child', { role: 'text', name: 'Hi' })],
    })
    const result = rebindUids(oldTree, newTree)
    expect(result).toEqual({ 'old-root': 'new-root', 'old-child': 'new-child' })
  })

  it('prefers matching by uid when both uid and fingerprint match', () => {
    const oldTree = node('same', { role: 'button', name: 'Go' })
    const newTree = node('same', { role: 'button', name: 'Go' })
    const result = rebindUids(oldTree, newTree)
    expect(result).toEqual({})
  })

  it('keeps the first node when two new nodes share a fingerprint', () => {
    const oldTree = node('old-1', { role: 'button', name: 'Go' })
    const newTree = node('root', {
      children: [
        node('new-1', { role: 'button', name: 'Go' }),
        node('new-2', { role: 'button', name: 'Go' }),
      ],
    })
    const result = rebindUids(oldTree, newTree)
    // Only the first matching new node is bound; the second is ignored.
    expect(result).toEqual({ 'old-1': 'new-1' })
  })

  it('does not rebind an old uid that is still present in the new tree', () => {
    const oldTree = node('a', { children: [node('b', { role: 'text', name: 'Hi' })] })
    const newTree = node('a', { children: [node('c', { role: 'text', name: 'Hi' })] })
    const result = rebindUids(oldTree, newTree)
    // 'b' is gone from the new tree, so it may rebind to 'c'; but 'a' is still
    // present, so it must not be rebound even if a fingerprint matches.
    expect(result).toEqual({ b: 'c' })
  })
})
