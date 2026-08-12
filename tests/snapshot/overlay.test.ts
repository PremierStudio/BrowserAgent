import { describe, expect, it } from 'vitest'
import { buildOverlay } from '../../src/snapshot/overlay.js'
import type { SnapshotNode } from '../../src/snapshot/a11ySnapshot.js'

function node(overrides: Partial<SnapshotNode> = {}): SnapshotNode {
  return {
    uid: 'loader-1_1',
    role: 'generic',
    name: '',
    ...overrides,
  }
}

describe('buildOverlay', () => {
  it('maps a node with a bounding box to its uid', () => {
    const snapshot = node({
      uid: 'loader-1_42',
      boundingBox: { x: 1, y: 2, width: 3, height: 4 },
    })
    expect(buildOverlay(snapshot)).toEqual({
      'loader-1_42': { x: 1, y: 2, width: 3, height: 4 },
    })
  })

  it('omits nodes without a bounding box', () => {
    const snapshot = node({ uid: 'loader-1_42' })
    const overlay = buildOverlay(snapshot)
    expect(overlay).toEqual({})
    expect('loader-1_42' in overlay).toBe(false)
  })

  it('recursively includes children with bounding boxes', () => {
    const snapshot = node({
      uid: 'loader-1_1',
      boundingBox: { x: 0, y: 0, width: 10, height: 10 },
      children: [
        node({
          uid: 'loader-1_2',
          boundingBox: { x: 1, y: 1, width: 2, height: 2 },
        }),
        node({ uid: 'loader-1_3' }),
      ],
    })
    expect(buildOverlay(snapshot)).toEqual({
      'loader-1_1': { x: 0, y: 0, width: 10, height: 10 },
      'loader-1_2': { x: 1, y: 1, width: 2, height: 2 },
    })
  })

  it('returns an empty object for an empty tree', () => {
    expect(buildOverlay(node({ uid: 'loader-1_1' }))).toEqual({})
  })
})
