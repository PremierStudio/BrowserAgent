import type { SnapshotNode } from '../snapshot/a11ySnapshot.js'

/** A mapping from an old uid to its rebind target uid. */
export type FingerprintMap = Record<string, string>

/**
 * Computes a stable fingerprint for a node based on its semantic content:
 * role, name, value, and children. The fingerprint is independent of the uid,
 * so a node whose uid changed (e.g. after navigation changed the loaderId)
 * can still be matched to its previous identity. Bounding boxes and z-index
 * are excluded — they are layout, not identity.
 */
export function fingerprint(node: SnapshotNode): string {
  const parts: string[] = [node.role, node.name]
  if (node.value !== undefined) {
    parts.push(node.value)
  }
  if (node.children !== undefined) {
    for (const child of node.children) {
      parts.push(fingerprint(child))
    }
  }
  return parts.join('\u0000')
}

/**
 * Rebuilds the uid mapping between two snapshots. For each node in the old
 * tree, if its fingerprint matches a node in the new tree but the uid differs,
 * records oldUid -> newUid. Nodes whose uid already matches are left alone.
 */
export function rebindUids(oldTree: SnapshotNode, newTree: SnapshotNode): FingerprintMap {
  const result: FingerprintMap = {}
  const newByFingerprint = new Map<string, string>()
  const newUids = new Set<string>()

  const collectNew = (node: SnapshotNode): void => {
    newUids.add(node.uid)
    const fp = fingerprint(node)
    if (!newByFingerprint.has(fp)) {
      newByFingerprint.set(fp, node.uid)
    }
    if (node.children !== undefined) {
      for (const child of node.children) {
        collectNew(child)
      }
    }
  }
  collectNew(newTree)

  const matchOld = (node: SnapshotNode): void => {
    // If the old uid is still present in the new tree, it is already stable;
    // do not rebind it to a different uid even if a fingerprint matches.
    if (!newUids.has(node.uid)) {
      const fp = fingerprint(node)
      const newUid = newByFingerprint.get(fp)
      if (newUid !== undefined && newUid !== node.uid) {
        result[node.uid] = newUid
      }
    }
    if (node.children !== undefined) {
      for (const child of node.children) {
        matchOld(child)
      }
    }
  }
  matchOld(oldTree)

  return result
}
