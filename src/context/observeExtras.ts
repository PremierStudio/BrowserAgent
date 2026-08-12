import type { PageLike } from './ContextPage.js'

/** Page URL and document title as observed from the live document. */
export interface PageState {
  url: string
  title: string
}

const READ_PAGE_STATE = '() => ({ url: location.href, title: document.title })'

const COLLECT_Z_INDEXES =
  '(ids) => { const out = []; if (!Array.isArray(ids)) { return out } for (const id of ids) { const el = document.querySelector("[data-backend-node-id=\\"" + String(id) + "\\"]"); if (el === null) { continue } const z = Number(getComputedStyle(el).zIndex); if (Number.isFinite(z)) { out.push({ id: id, z: z }) } } return out }'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPageState(value: unknown): value is PageState {
  return isRecord(value) && typeof value.url === 'string' && typeof value.title === 'string'
}

function parseIdKey(key: string): number | undefined {
  if (key === '') {
    return undefined
  }
  const id = Number(key)
  if (Number.isFinite(id)) {
    return id
  }
  return undefined
}

function addPair(map: Map<number, number>, id: unknown, z: unknown): void {
  if (isFiniteNumber(id) && isFiniteNumber(z)) {
    map.set(id, z)
  }
}

function zIndexesFromArray(items: unknown[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const item of items) {
    if (!isRecord(item)) {
      continue
    }
    addPair(map, item.id, item.z)
  }
  return map
}

function zIndexesFromRecord(record: Record<string, unknown>): Map<number, number> {
  const map = new Map<number, number>()
  for (const key of Object.keys(record)) {
    const id = parseIdKey(key)
    if (id === undefined) {
      continue
    }
    addPair(map, id, record[key])
  }
  return map
}

function zIndexesFrom(value: unknown): Map<number, number> {
  if (Array.isArray(value)) {
    return zIndexesFromArray(value)
  }
  if (isRecord(value)) {
    return zIndexesFromRecord(value)
  }
  return new Map()
}

/** Enables the CDP Accessibility domain on the page session. */
export async function enableAccessibility(page: PageLike): Promise<void> {
  await page.cdp('page', 'Accessibility.enable')
}

/** Reads the live document URL and title via page.evaluate. */
export async function readPageState(page: PageLike): Promise<PageState> {
  const result = await page.evaluate(READ_PAGE_STATE)
  if (isPageState(result)) {
    return result
  }
  return { url: '', title: '' }
}

/**
 * Collects computed z-index values for the given backend node ids via a
 * single page.evaluate. Empty input skips evaluation.
 */
export async function collectZIndexes(
  page: PageLike,
  backendNodeIds: number[],
): Promise<Map<number, number>> {
  if (backendNodeIds.length === 0) {
    return new Map()
  }
  const result = await page.evaluate(COLLECT_Z_INDEXES, backendNodeIds)
  return zIndexesFrom(result)
}
