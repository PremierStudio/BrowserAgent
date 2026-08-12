import type { SnapshotNode } from '../snapshot/a11ySnapshot.js'
import { diffSnapshots, type DiffResult } from './diff.js'
import { rebindUids } from './fingerprint.js'

/**
 * Single-consumer diff state (decision #15). Holds the last observed snapshot
 * and computes the diff against it on each new observation (last-observe-wins).
 * An owner token gates access so concurrent read-only observes cannot race the
 * diff. Uids are rebound across navigation via fingerprint matching, so a node
 * that survives navigation is reported as a change, not a remove+add.
 */
export class DiffTracker {
  private readonly owner: string
  private last: SnapshotNode | undefined

  constructor(owner: string) {
    this.owner = owner
  }

  observe(token: string, snapshot: SnapshotNode): DiffResult {
    if (token !== this.owner) {
      throw new Error(`DiffTracker is owned by "${this.owner}", not "${token}"`)
    }
    if (this.last === undefined) {
      this.last = snapshot
      return { added: [], removed: [], changed: [] }
    }

    const rebind = rebindUids(this.last, snapshot)
    const rebased = this.applyRebind(this.last, rebind)
    const result = diffSnapshots(rebased, snapshot)
    this.last = snapshot
    return result
  }

  private applyRebind(node: SnapshotNode, rebind: Record<string, string>): SnapshotNode {
    const target = rebind[node.uid]
    const copy: SnapshotNode = {
      uid: target ?? node.uid,
      role: node.role,
      name: node.name,
    }
    if (node.value !== undefined) {
      copy.value = node.value
    }
    if (node.boundingBox !== undefined) {
      copy.boundingBox = node.boundingBox
    }
    if (node.children !== undefined) {
      copy.children = node.children.map((child) => this.applyRebind(child, rebind))
    }
    return copy
  }
}
