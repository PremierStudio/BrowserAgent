import type { DiffResult } from '../diff/diff.js'
import type { BoundingBox, SnapshotNode } from '../snapshot/a11ySnapshot.js'
import type { Overlay } from '../snapshot/overlay.js'

/** A target that explain() describes. */
export type ExplainTarget =
  | { kind: 'uid'; uid: string }
  | { kind: 'region'; x: number; y: number; width: number; height: number }
  | { kind: 'diff'; diff: DiffResult }

/** A visual annotation produced alongside the summary. */
interface ExplainAnnotation {
  uid?: string
  box?: BoundingBox
  highlight: 'ring' | 'region' | 'diff' | 'none'
}

/** The explain result: a human-readable summary plus an annotation. */
export interface ExplainResult {
  summary: string
  annotation: ExplainAnnotation
}

function findNode(node: SnapshotNode, uid: string): SnapshotNode | undefined {
  if (node.uid === uid) {
    return node
  }
  if (node.children === undefined) {
    return undefined
  }
  for (const child of node.children) {
    const found = findNode(child, uid)
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

function overlaps(
  box: BoundingBox,
  region: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    box.x < region.x + region.width &&
    box.x + box.width > region.x &&
    box.y < region.y + region.height &&
    box.y + box.height > region.y
  )
}

/** Produces a summary and visual annotation for a uid, region, or diff. */
export function explain(
  snapshot: SnapshotNode,
  overlay: Overlay,
  target: ExplainTarget,
): ExplainResult {
  if (target.kind === 'uid') {
    const node = findNode(snapshot, target.uid)
    if (node === undefined) {
      return { summary: `uid ${target.uid} not found`, annotation: { highlight: 'none' } }
    }
    const box = overlay[target.uid] ?? node.boundingBox
    const annotation: ExplainAnnotation = { uid: target.uid, highlight: 'ring' }
    if (box !== undefined) {
      annotation.box = box
    }
    return {
      summary: `${node.role} "${node.name}" (${target.uid})`,
      annotation,
    }
  }
  if (target.kind === 'region') {
    const hits: string[] = []
    for (const [uid, box] of Object.entries(overlay)) {
      if (overlaps(box, target)) {
        hits.push(uid)
      }
    }
    const list = hits.length === 0 ? 'no elements' : hits.join(', ')
    return {
      summary: `region (${target.x},${target.y} ${target.width}x${target.height}): ${list}`,
      annotation: { highlight: 'region' },
    }
  }
  const { added, removed, changed } = target.diff
  return {
    summary: `diff: ${added.length} added, ${removed.length} removed, ${changed.length} changed`,
    annotation: { highlight: 'diff' },
  }
}
