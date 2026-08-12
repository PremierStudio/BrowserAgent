import { describe, expect, it } from 'vitest'
import { applyRebind, DiffTracker } from '../../src/diff/DiffTracker.js'
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
    expect(result).toStrictEqual({ added: [], removed: [], changed: [] })
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
    expect(result).toStrictEqual({ added: [], removed: [], changed: [] })
  })

  it('reports a box appearing after a rebind of a node that omitted one', () => {
    const tracker = new DiffTracker('owner')
    tracker.observe('owner', node('old-1', { role: 'textbox', name: 'Field' }))
    const result = tracker.observe(
      'owner',
      node('new-1', {
        role: 'textbox',
        name: 'Field',
        boundingBox: { x: 1, y: 2, width: 3, height: 4 },
      }),
    )
    expect(result).toStrictEqual({
      added: [],
      removed: [],
      changed: [
        {
          uid: 'new-1',
          boundingBox: {
            from: { x: 0, y: 0, width: 0, height: 0 },
            to: { x: 1, y: 2, width: 3, height: 4 },
          },
        },
      ],
    })
  })

  it('does not invent value or box changes when both snapshots omit them', () => {
    const tracker = new DiffTracker('owner')
    tracker.observe('owner', node('a', { role: 'button', name: 'Go' }))
    const result = tracker.observe('owner', node('a', { role: 'button', name: 'Go' }))
    expect(result).toStrictEqual({ added: [], removed: [], changed: [] })
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

describe('applyRebind', () => {
  it('omits value and boundingBox when the source node omitted them', () => {
    const copy = applyRebind(node('old', { role: 'button', name: 'Go' }), { old: 'new' })
    expect(copy).toEqual({ uid: 'new', role: 'button', name: 'Go' })
    expect('value' in copy).toBe(false)
    expect('boundingBox' in copy).toBe(false)
  })

  it('copies value and boundingBox only when they are defined', () => {
    const copy = applyRebind(
      node('a', {
        value: 'typed',
        boundingBox: { x: 1, y: 2, width: 3, height: 4 },
      }),
      {},
    )
    expect(copy.value).toBe('typed')
    expect(copy.boundingBox).toEqual({ x: 1, y: 2, width: 3, height: 4 })
  })
})
