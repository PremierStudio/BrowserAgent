import { describe, expect, it } from 'vitest'
import { explain } from '../../src/intent/explain.js'
import type { SnapshotNode } from '../../src/snapshot/a11ySnapshot.js'
import type { Overlay } from '../../src/snapshot/overlay.js'
import type { DiffResult } from '../../src/diff/diff.js'

const tree: SnapshotNode = {
  uid: 'root',
  role: 'document',
  name: 'Home',
  children: [
    {
      uid: 'btn-1',
      role: 'button',
      name: 'Submit',
      boundingBox: { x: 10, y: 20, width: 80, height: 24 },
    },
  ],
}

const overlay: Overlay = {
  'btn-1': { x: 10, y: 20, width: 80, height: 24 },
}

const siblings: SnapshotNode = {
  uid: 'root',
  role: 'document',
  name: 'Home',
  children: [
    { uid: 'link-1', role: 'link', name: 'Skip' },
    {
      uid: 'btn-1',
      role: 'button',
      name: 'Submit',
      boundingBox: { x: 10, y: 20, width: 80, height: 24 },
    },
  ],
}

describe('explain', () => {
  it('explains a uid with its role, name, and box', () => {
    const result = explain(tree, overlay, { kind: 'uid', uid: 'btn-1' })
    expect(result.summary).toBe('button "Submit" (btn-1)')
    expect(result.annotation).toStrictEqual({
      uid: 'btn-1',
      highlight: 'ring',
      box: { x: 10, y: 20, width: 80, height: 24 },
    })
  })

  it('explains a missing uid', () => {
    const result = explain(tree, overlay, { kind: 'uid', uid: 'nope' })
    expect(result.summary).toBe('uid nope not found')
    expect(result.annotation).toStrictEqual({ highlight: 'none' })
  })

  it('finds a uid on a later sibling after an earlier branch misses', () => {
    const result = explain(siblings, overlay, { kind: 'uid', uid: 'btn-1' })
    expect(result.summary).toBe('button "Submit" (btn-1)')
    expect(result.annotation.uid).toBe('btn-1')
  })

  it('falls back to the snapshot bounding box when the overlay has no entry', () => {
    const result = explain(tree, {}, { kind: 'uid', uid: 'btn-1' })
    expect(result.annotation.box).toEqual({ x: 10, y: 20, width: 80, height: 24 })
  })

  it('omits the box when neither overlay nor snapshot has one', () => {
    const result = explain(
      { uid: 'root', role: 'generic', name: 'x' },
      {},
      { kind: 'uid', uid: 'root' },
    )
    expect(result.summary).toBe('generic "x" (root)')
    expect(result.annotation).toStrictEqual({ uid: 'root', highlight: 'ring' })
    expect('box' in result.annotation).toBe(false)
  })

  it('explains a region by listing overlapping uids separated by comma-space', () => {
    const two: Overlay = {
      'btn-1': { x: 10, y: 20, width: 80, height: 24 },
      'btn-2': { x: 15, y: 22, width: 10, height: 10 },
    }
    const result = explain(tree, two, {
      kind: 'region',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    })
    expect(result.summary).toBe('region (0,0 100x100): btn-1, btn-2')
    expect(result.annotation).toStrictEqual({ highlight: 'region' })
  })

  it('explains a region with no overlapping uids', () => {
    const result = explain(tree, overlay, { kind: 'region', x: 500, y: 500, width: 10, height: 10 })
    expect(result.summary).toBe('region (500,500 10x10): no elements')
    expect(result.annotation).toStrictEqual({ highlight: 'region' })
  })

  it('treats boxes that only touch a region edge as non-overlapping', () => {
    // btn-1 occupies x [10, 90] and y [20, 44]. Touching an edge must not count.
    const cases: { region: { x: number; y: number; width: number; height: number } }[] = [
      { region: { x: 0, y: 20, width: 10, height: 24 } },
      { region: { x: 90, y: 20, width: 10, height: 24 } },
      { region: { x: 10, y: 0, width: 80, height: 20 } },
      { region: { x: 10, y: 44, width: 80, height: 10 } },
    ]
    for (const { region } of cases) {
      const result = explain(tree, overlay, { kind: 'region', ...region })
      expect(result.summary).toBe(
        `region (${region.x},${region.y} ${region.width}x${region.height}): no elements`,
      )
    }
  })

  it('counts a one-pixel interior overlap on each axis', () => {
    const justInside = explain(tree, overlay, { kind: 'region', x: 9, y: 20, width: 2, height: 4 })
    expect(justInside.summary).toBe('region (9,20 2x4): btn-1')
    const justInsideY = explain(tree, overlay, {
      kind: 'region',
      x: 10,
      y: 19,
      width: 4,
      height: 2,
    })
    expect(justInsideY.summary).toBe('region (10,19 4x2): btn-1')
  })

  it('explains a diff with added, removed, and changed counts', () => {
    const diff: DiffResult = {
      added: [{ uid: 'a' }],
      removed: [{ uid: 'b' }, { uid: 'c' }],
      changed: [{ uid: 'd' }],
    }
    const result = explain(tree, overlay, { kind: 'diff', diff })
    expect(result.summary).toBe('diff: 1 added, 2 removed, 1 changed')
    expect(result.annotation).toStrictEqual({ highlight: 'diff' })
  })
})
