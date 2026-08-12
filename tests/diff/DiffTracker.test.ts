import { describe, expect, it } from 'vitest'
import { DiffTracker } from '../../src/diff/DiffTracker.js'
import type { SnapshotNode } from '../../src/snapshot/a11ySnapshot.js'

function node(uid: string, overrides: Partial<SnapshotNode> = {}): SnapshotNode {
  return { uid, role: 'generic', name: '', ...overrides }
}

describe('DiffTracker', () => {
  it('returns an empty diff on the first observation', () => {
    const tracker = new DiffTracker('owner')
    const result = tracker.observe('owner', node('a'))
    expect(result).toEqual({ added: [], removed: [], changed: [] })
  })

  it('rejects a non-owner token', () => {
    const tracker = new DiffTracker('owner')
    expect(() => tracker.observe('intruder', node('a'))).toThrow(/owner/i)
  })

  it('reports changes between observations (last-observe-wins)', () => {
    const tracker = new DiffTracker('owner')
    tracker.observe('owner', node('a', { children: [node('b')] }))
    const result = tracker.observe('owner', node('a', { children: [node('b'), node('c')] }))
    expect(result.added).toEqual([{ uid: 'c' }])
  })

  it('rebinds uids across navigation', () => {
    const tracker = new DiffTracker('owner')
    tracker.observe('owner', node('old-1', { role: 'button', name: 'Go' }))
    const result = tracker.observe('owner', node('new-1', { role: 'button', name: 'Go' }))
    // The node is the same (fingerprint matches) but its uid changed; the
    // tracker reports the rebind rather than a remove+add.
    expect(result.removed).toEqual([])
    expect(result.added).toEqual([])
  })

  it('preserves value and bounding box across a rebind', () => {
    const tracker = new DiffTracker('owner')
    tracker.observe(
      'owner',
      node('old-1', {
        role: 'textbox',
        name: 'Field',
        value: 'x',
        boundingBox: { x: 1, y: 2, width: 3, height: 4 },
      }),
    )
    const result = tracker.observe(
      'owner',
      node('new-1', {
        role: 'textbox',
        name: 'Field',
        value: 'x',
        boundingBox: { x: 1, y: 2, width: 3, height: 4 },
      }),
    )
    expect(result.removed).toEqual([])
    expect(result.added).toEqual([])
    expect(result.changed).toEqual([])
  })

  it('reports a removed node after it disappears', () => {
    const tracker = new DiffTracker('owner')
    tracker.observe('owner', node('a', { children: [node('b', { role: 'text', name: 'Bye' })] }))
    const result = tracker.observe('owner', node('a'))
    expect(result.removed).toEqual([{ uid: 'b' }])
  })

  it('tracks the latest snapshot as the baseline', () => {
    const tracker = new DiffTracker('owner')
    tracker.observe('owner', node('a', { value: 'x' }))
    tracker.observe('owner', node('a', { value: 'y' }))
    // The second observation changed x -> y; the third sees no change.
    const result = tracker.observe('owner', node('a', { value: 'y' }))
    expect(result.changed).toEqual([])
  })
})
