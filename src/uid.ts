/** The parsed components of a stable element uid. */
export interface UidParts {
  loaderId: string
  backendNodeId: number
}

const SEPARATOR = '_'

/**
 * Builds a stable, deterministic element uid keyed by `loaderId_backendNodeId`
 * (borrowed from chrome-devtools-mcp). The same inputs always yield the same
 * uid, so the model can reference an element across turns. A missing loaderId
 * is normalized to a placeholder so the uid is still parseable.
 */
export function createUid(loaderId: string, backendNodeId: number): string {
  const normalizedLoader = loaderId.length > 0 ? loaderId : 'no-loader'
  return `${normalizedLoader}${SEPARATOR}${backendNodeId}`
}

/**
 * Parses a uid back into its parts. Returns null when the uid is malformed
 * (missing separator or non-numeric backendNodeId). The loaderId is taken as
 * everything before the final separator, so loaderIds containing the separator
 * still round-trip.
 */
export function parseUid(uid: string): UidParts | null {
  const separatorIndex = uid.lastIndexOf(SEPARATOR)
  if (separatorIndex <= 0 || separatorIndex === uid.length - 1) {
    return null
  }
  const loaderId = uid.slice(0, separatorIndex)
  const backendNodeId = Number(uid.slice(separatorIndex + 1))
  if (!Number.isInteger(backendNodeId)) {
    return null
  }
  return { loaderId, backendNodeId }
}
