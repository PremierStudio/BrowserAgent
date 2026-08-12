import { createUid } from '../uid.js'

/** A bounding box in CSS pixels. */
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/** A raw accessibility node as produced by the browser/CDP layer. */
export interface RawA11yNode {
  role: string
  name: string
  value?: string
  backendDOMNodeId: number
  loaderId: string
  boundingBox?: BoundingBox
  zIndex?: number
  children?: RawA11yNode[]
}

/** A normalized snapshot node with a stable uid. */
export interface SnapshotNode {
  uid: string
  role: string
  name: string
  value?: string
  boundingBox?: BoundingBox
  zIndex?: number
  children?: SnapshotNode[]
}

/**
 * Transforms a raw accessibility tree into a normalized snapshot tree. Each
 * node gets a stable uid keyed by loaderId_backendNodeId. Empty optional
 * fields and empty children arrays are omitted to keep the snapshot compact
 * (token-optimized).
 */
export function buildSnapshot(node: RawA11yNode): SnapshotNode {
  const snapshot: SnapshotNode = {
    uid: createUid(node.loaderId, node.backendDOMNodeId),
    role: node.role,
    name: node.name,
  }
  if (node.value !== undefined) {
    snapshot.value = node.value
  }
  if (node.boundingBox !== undefined) {
    snapshot.boundingBox = node.boundingBox
  }
  if (node.zIndex !== undefined) {
    snapshot.zIndex = node.zIndex
  }
  if (node.children !== undefined && node.children.length > 0) {
    snapshot.children = node.children.map((child) => buildSnapshot(child))
  }
  return snapshot
}
