import type { PageLike } from './ContextPage.js'
import { parseUid } from '../uid.js'

/** A uid resolved to a live CDP remote object. */
export interface ResolvedUid {
  uid: string
  backendNodeId: number
  objectId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function objectIdFrom(result: unknown): string {
  if (!isRecord(result) || !isRecord(result.object) || typeof result.object.objectId !== 'string') {
    throw new Error('Failed to resolve element')
  }
  return result.object.objectId
}

/**
 * Resolves a stable uid to a CDP remote object via DOM.resolveNode.
 * Throws when the uid is malformed or the node cannot be resolved.
 */
export async function resolveUid(page: PageLike, uid: string): Promise<ResolvedUid> {
  const parts = parseUid(uid)
  if (parts === null) {
    throw new Error(`Invalid uid: ${uid}`)
  }
  const resolved = await page.cdp('page', 'DOM.resolveNode', {
    backendNodeId: parts.backendNodeId,
  })
  return {
    uid,
    backendNodeId: parts.backendNodeId,
    objectId: objectIdFrom(resolved),
  }
}
