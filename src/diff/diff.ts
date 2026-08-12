import type { BoundingBox, SnapshotNode } from '../snapshot/a11ySnapshot.js'

/** A single change to a node's field. */
interface FieldChange<T> {
  from: T
  to: T
}

/** The set of changes detected on a single node. */
interface NodeChange {
  uid: string
  value?: FieldChange<string>
  name?: FieldChange<string>
  role?: FieldChange<string>
  boundingBox?: FieldChange<BoundingBox>
}

/** The result of diffing two snapshots. */
export interface DiffResult {
  added: { uid: string }[]
  removed: { uid: string }[]
  changed: NodeChange[]
}

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Diffs two snapshot trees by uid, reporting nodes added, removed, or changed
 * (value/name/role/boundingBox). zIndex is a layout hint, not a semantic
 * change, so it is ignored. Only the changed fields are reported, keeping the
 * output token-optimized.
 */
export function diffSnapshots(oldTree: SnapshotNode, newTree: SnapshotNode): DiffResult {
  const result: DiffResult = { added: [], removed: [], changed: [] }
  const oldById = new Map<string, SnapshotNode>()
  const newById = new Map<string, SnapshotNode>()

  const collect = (node: SnapshotNode, map: Map<string, SnapshotNode>): void => {
    map.set(node.uid, node)
    if (node.children !== undefined) {
      for (const child of node.children) {
        collect(child, map)
      }
    }
  }

  collect(oldTree, oldById)
  collect(newTree, newById)

  for (const [uid, oldNode] of oldById) {
    const newNode = newById.get(uid)
    if (newNode === undefined) {
      result.removed.push({ uid })
      continue
    }
    const change = diffNode(oldNode, newNode)
    if (change !== undefined) {
      result.changed.push(change)
    }
  }

  for (const uid of newById.keys()) {
    if (!oldById.has(uid)) {
      result.added.push({ uid })
    }
  }

  return result
}

function diffNode(oldNode: SnapshotNode, newNode: SnapshotNode): NodeChange | undefined {
  const change: NodeChange = { uid: oldNode.uid }
  let hasChange = false

  if (oldNode.value !== newNode.value) {
    change.value = { from: oldNode.value ?? '', to: newNode.value ?? '' }
    hasChange = true
  }
  if (oldNode.name !== newNode.name) {
    change.name = { from: oldNode.name, to: newNode.name }
    hasChange = true
  }
  if (oldNode.role !== newNode.role) {
    change.role = { from: oldNode.role, to: newNode.role }
    hasChange = true
  }
  if (!isEqual(oldNode.boundingBox, newNode.boundingBox)) {
    change.boundingBox = {
      from: oldNode.boundingBox ?? { x: 0, y: 0, width: 0, height: 0 },
      to: newNode.boundingBox ?? { x: 0, y: 0, width: 0, height: 0 },
    }
    hasChange = true
  }

  return hasChange ? change : undefined
}
