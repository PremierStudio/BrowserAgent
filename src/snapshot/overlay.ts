import type { BoundingBox, SnapshotNode } from './a11ySnapshot.js'

/** A mapping from element uid to its pixel bounding box. */
export type Overlay = Record<string, BoundingBox>

/**
 * Builds a uid → pixel box mapping by walking a snapshot tree. Nodes without a
 * bounding box are omitted, so the overlay only contains elements the model
 * can actually target.
 */
export function buildOverlay(snapshot: SnapshotNode): Overlay {
  const overlay: Overlay = {}
  collect(snapshot, overlay)
  return overlay
}

function collect(node: SnapshotNode, overlay: Overlay): void {
  if (node.boundingBox !== undefined) {
    overlay[node.uid] = node.boundingBox
  }
  if (node.children !== undefined) {
    for (const child of node.children) {
      collect(child, overlay)
    }
  }
}
