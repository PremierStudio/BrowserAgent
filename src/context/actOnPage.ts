import type { PageLike } from './ContextPage.js'
import { parseUid } from '../uid.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function objectIdFrom(result: unknown): string {
  if (!isRecord(result) || !isRecord(result.object) || typeof result.object.objectId !== 'string') {
    throw new Error('Failed to resolve element')
  }
  return result.object.objectId
}

async function resolveObjectId(page: PageLike, uid: string): Promise<string> {
  const parts = parseUid(uid)
  if (parts === null) {
    throw new Error(`Invalid uid: ${uid}`)
  }
  const resolved = await page.cdp('page', 'DOM.resolveNode', { backendNodeId: parts.backendNodeId })
  return objectIdFrom(resolved)
}

async function callOn(
  page: PageLike,
  objectId: string,
  functionDeclaration: string,
): Promise<void> {
  await page.cdp('page', 'Runtime.callFunctionOn', { objectId, functionDeclaration })
}

/** Clicks the element identified by uid via CDP resolve + callFunctionOn. */
export async function clickUid(page: PageLike, uid: string): Promise<void> {
  const objectId = await resolveObjectId(page, uid)
  await callOn(page, objectId, 'function() { this.click(); }')
}

/** Types text into the element identified by uid. */
export async function typeUid(page: PageLike, uid: string, text: string): Promise<void> {
  const objectId = await resolveObjectId(page, uid)
  await callOn(
    page,
    objectId,
    `function() { this.focus(); this.value = (this.value || '') + ${JSON.stringify(text)}; this.dispatchEvent(new Event('input', { bubbles: true })); }`,
  )
}

/** Hovers the element identified by uid. */
export async function hoverUid(page: PageLike, uid: string): Promise<void> {
  const objectId = await resolveObjectId(page, uid)
  await callOn(
    page,
    objectId,
    'function() { this.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); }',
  )
}

/** Scrolls within the element identified by uid. */
export async function scrollUid(
  page: PageLike,
  uid: string,
  dx: number,
  dy: number,
): Promise<void> {
  const objectId = await resolveObjectId(page, uid)
  await callOn(page, objectId, `function() { this.scrollBy(${dx}, ${dy}); }`)
}

/** Selects a value on the element identified by uid. */
export async function selectUid(page: PageLike, uid: string, value: string): Promise<void> {
  const objectId = await resolveObjectId(page, uid)
  await callOn(
    page,
    objectId,
    `function() { this.value = ${JSON.stringify(value)}; this.dispatchEvent(new Event('change', { bubbles: true })); }`,
  )
}

/** Presses a key on the page. */
export async function pressKey(page: PageLike, key: string): Promise<void> {
  await page.keyboardPress(key)
}

/** Navigates the page to a URL. */
export async function navigateTo(page: PageLike, url: string): Promise<void> {
  await page.goto(url)
}
