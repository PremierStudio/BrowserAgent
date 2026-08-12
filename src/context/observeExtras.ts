import type { PageLike } from './ContextPage.js'

/** Page URL and document title as observed from the live document. */
export interface PageState {
  url: string
  title: string
}

const READ_PAGE_STATE = '({ url: location.href, title: document.title })'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return Number.isFinite(value)
}

function isPageState(value: unknown): value is PageState {
  return isRecord(value) && typeof value.url === 'string' && typeof value.title === 'string'
}

/** Reads a CDP remote objectId. Exported so tests can pin the guard. */
export function objectIdFrom(result: unknown): string | undefined {
  if (!isRecord(result) || !isRecord(result.object) || typeof result.object.objectId !== 'string') {
    return undefined
  }
  return result.object.objectId
}

/** Reads a numeric z-index from Runtime.callFunctionOn. */
export function zFromCall(result: unknown): number | undefined {
  if (!isRecord(result) || !isRecord(result.result)) {
    return undefined
  }
  const value = result.result.value
  if (isFiniteNumber(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
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
 * Collects computed z-index values for the given backend node ids via CDP
 * DOM.resolveNode + Runtime.callFunctionOn(getComputedStyle). Empty input
 * skips CDP. Nodes that fail to resolve or have a non-numeric z-index are
 * omitted.
 */
export async function collectZIndexes(
  page: PageLike,
  backendNodeIds: number[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  for (const id of backendNodeIds) {
    try {
      const resolved = await page.cdp('page', 'DOM.resolveNode', { backendNodeId: id })
      const objectId = objectIdFrom(resolved)
      if (objectId === undefined) {
        continue
      }
      const called = await page.cdp('page', 'Runtime.callFunctionOn', {
        objectId,
        functionDeclaration: 'function() { return getComputedStyle(this).zIndex }',
        returnByValue: true,
      })
      const z = zFromCall(called)
      if (z !== undefined) {
        map.set(id, z)
      }
    } catch {
      // Node may be detached. Skip it and keep collecting the rest.
    }
  }
  return map
}
