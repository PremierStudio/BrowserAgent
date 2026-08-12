import type { SnapshotNode } from '../../src/snapshot/a11ySnapshot.js'

/** Local page used by the Chrome observe suite. */
export const OBSERVE_BUTTON_HTML =
  '<!doctype html><html lang="en"><head><title>Observe</title></head><body><button id="go">Go</button></body></html>'

/** Depth-first flattening of a snapshot tree. */
function flattenSnapshot(node: SnapshotNode): SnapshotNode[] {
  const nodes: SnapshotNode[] = [node]
  if (node.children === undefined) {
    return nodes
  }
  for (const child of node.children) {
    const descendants = flattenSnapshot(child)
    for (const descendant of descendants) {
      nodes.push(descendant)
    }
  }
  return nodes
}

/** First snapshot node matching both role and accessible name. */
export function findSnapshotNode(
  root: SnapshotNode,
  role: string,
  name: string,
): SnapshotNode | undefined {
  for (const node of flattenSnapshot(root)) {
    if (node.role === role && node.name === name) {
      return node
    }
  }
  return undefined
}

/** Prefers the Go button uid, otherwise the first non-empty uid in the tree. */
export function firstClickableUid(root: SnapshotNode): string | undefined {
  const named = findSnapshotNode(root, 'button', 'Go')
  if (named !== undefined && named.uid.length > 0) {
    return named.uid
  }
  for (const node of flattenSnapshot(root)) {
    if (node.uid.length > 0) {
      return node.uid
    }
  }
  return undefined
}
