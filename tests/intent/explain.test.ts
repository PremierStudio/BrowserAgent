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

describe('explain', () => {
  it('explains a uid with its role, name, and box', () => {
    const result = explain(tree, overlay, { kind: 'uid', uid: 'btn-1' })
    expect(result.summary).toMatch(/button/)
    expect(result.summary).toMatch(/Submit/)
    expect(result.annotation.uid).toBe('btn-1')
    expect(result.annotation.box).toEqual({ x: 10, y: 20, width: 80, height: 24 })
    expect(result.annotation.highlight).toBe('ring')
  })

  it('explains a missing uid', () => {
    const result = explain(tree, overlay, { kind: 'uid', uid: 'nope' })
    expect(result.summary).toMatch(/not found/)
    expect(result.annotation.highlight).toBe('none')
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
    expect(result.annotation.box).toBeUndefined()
    expect(result.annotation.highlight).toBe('ring')
  })

  it('explains a region by listing overlapping uids', () => {
    const result = explain(tree, overlay, {
      kind: 'region',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    })
    expect(result.summary).toMatch(/btn-1/)
    expect(result.annotation.highlight).toBe('region')
  })

  it('explains a region with no overlapping uids', () => {
    const result = explain(tree, overlay, { kind: 'region', x: 500, y: 500, width: 10, height: 10 })
    expect(result.summary).toMatch(/no elements/)
    expect(result.annotation.highlight).toBe('region')
  })

  it('explains a diff with added, removed, and changed counts', () => {
    const diff: DiffResult = {
      added: [{ uid: 'a' }],
      removed: [{ uid: 'b' }, { uid: 'c' }],
      changed: [{ uid: 'd' }],
    }
    const result = explain(tree, overlay, { kind: 'diff', diff })
    expect(result.summary).toMatch(/1 added/)
    expect(result.summary).toMatch(/2 removed/)
    expect(result.summary).toMatch(/1 changed/)
    expect(result.annotation.highlight).toBe('diff')
  })
})
