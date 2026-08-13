import type { OutlineItem } from '../snapshot/outline.js'
import { allSameNonEmptyFold, labelScore } from '../label.js'

/** How a flow step points at a control without a uid. */
export type TargetQuery = {
  readonly uid?: string
  readonly name?: string
  readonly role?: string
  readonly near?: string
  readonly action?: string
}

/** Unique bind, a miss, or a tie at the winning name score. */
export type BindResult =
  | { readonly status: 'bound'; readonly uid: string; readonly candidates: readonly OutlineItem[] }
  | {
      readonly status: 'none' | 'ambiguous'
      readonly uid: undefined
      readonly candidates: readonly OutlineItem[]
    }

/** Printed candidate cap so a miss stays readable. */
export const BIND_CANDIDATE_LIMIT = 12

const TYPEABLE = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton'])
const CLICKABLE = new Set(['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'switch'])

/** Folded exact or substring match. Empty query never matches. */
export function namesMatch(itemName: string, query: string): boolean {
  return nameScore(itemName, query) > 0
}

function nameScore(itemName: string, query: string): number {
  return labelScore(itemName, query)
}

/** Name outranks value, value outranks context. Zero if nothing matches. */
function landmarkScore(item: OutlineItem, query: string): number {
  const named = labelScore(item.name, query)
  const valued = item.value === undefined ? 0 : labelScore(item.value, query)
  const context = item.context === undefined ? 0 : labelScore(item.context, query)
  return named * 100 + valued * 10 + context
}

/** Select/type may bind an unlabeled field from its value or nearby label. */
function controlScore(item: OutlineItem, query: string, action: string | undefined): number {
  if (action !== 'select' && action !== 'type') {
    return nameScore(item.name, query)
  }
  return landmarkScore(item, query)
}

function sameFoldedName(items: readonly OutlineItem[]): boolean {
  const names: string[] = []
  for (const item of items) {
    names.push(item.name)
  }
  return allSameNonEmptyFold(names)
}

function sameNonEmptyContext(items: readonly OutlineItem[]): boolean {
  const contexts: string[] = []
  for (const item of items) {
    contexts.push(item.context ?? '')
  }
  return allSameNonEmptyFold(contexts)
}

/** Overlay clones: same CTA, same card title. Distinct products stay a tie. */
function overlayClones(items: readonly OutlineItem[]): boolean {
  return sameFoldedName(items) && sameNonEmptyContext(items)
}

function roleAllowed(item: OutlineItem, query: TargetQuery): boolean {
  if (query.role !== undefined) {
    return item.role === query.role
  }
  if (query.action === 'type') {
    return TYPEABLE.has(item.role)
  }
  if (query.action === 'select') {
    return item.role === 'combobox'
  }
  if (query.action === 'click' || query.action === 'hover') {
    return CLICKABLE.has(item.role)
  }
  return true
}

function uniqueAtScore(
  items: readonly OutlineItem[],
  scoreOf: (item: OutlineItem) => number,
): OutlineItem[] {
  const hits: OutlineItem[] = []
  for (const hit of uniqueIndexed(items, scoreOf)) {
    hits.push(hit.item)
  }
  return hits
}

function firstHit(hits: readonly OutlineItem[]): OutlineItem | undefined {
  for (const item of hits) {
    return item
  }
  return undefined
}

function missPool(
  windowItems: readonly OutlineItem[],
  query: TargetQuery,
  name: string,
): OutlineItem[] {
  const traps = uniqueAtScore(windowItems, (item) => nameScore(item.name, name))
  const seen = new Set<string>()
  const candidates: OutlineItem[] = []
  for (const item of traps) {
    seen.add(item.uid)
    candidates.push(item)
  }
  for (const item of windowItems) {
    if (!roleAllowed(item, query) || seen.has(item.uid)) {
      continue
    }
    seen.add(item.uid)
    candidates.push(item)
  }
  return candidates
}

function bound(item: OutlineItem): BindResult {
  return { status: 'bound', uid: item.uid, candidates: [item] }
}

function none(candidates: readonly OutlineItem[]): BindResult {
  return { status: 'none', uid: undefined, candidates }
}

function ambiguous(candidates: readonly OutlineItem[]): BindResult {
  return { status: 'ambiguous', uid: undefined, candidates }
}

function pickUnique(hits: readonly OutlineItem[]): BindResult {
  const winner = firstHit(hits)
  if (winner === undefined) {
    return none([])
  }
  if (hits.length > 1) {
    return ambiguous(hits)
  }
  return bound(winner)
}

function uniqueIndexed(
  items: readonly OutlineItem[],
  scoreOf: (item: OutlineItem) => number,
): { item: OutlineItem; index: number }[] {
  let best = 0
  const hits: { item: OutlineItem; index: number }[] = []
  for (const [index, item] of items.entries()) {
    const score = scoreOf(item)
    if (score <= 0) {
      continue
    }
    if (score > best) {
      best = score
      hits.length = 0
      hits.push({ item, index })
      continue
    }
    if (score === best) {
      hits.push({ item, index })
    }
  }
  return hits
}

function landmarkStart(items: readonly OutlineItem[], near: string): BindResult | number {
  const landmarks = uniqueIndexed(items, (item) => landmarkScore(item, near))
  if (landmarks.length === 0) {
    return pickUnique([])
  }
  const picked: OutlineItem[] = []
  for (const hit of landmarks) {
    picked.push(hit.item)
  }
  if (landmarks.length > 1 && !sameFoldedName(picked)) {
    return pickUnique(picked)
  }
  let start = 0
  for (const hit of landmarks) {
    start = hit.index + 1
    break
  }
  return start
}

/**
 * Unique live bind. uid wins. Exact names beat substring hits.
 * A global tie at the winning score is a miss with candidates, not a guess.
 * `near` picks the closest winner after a unique landmark.
 */
export function bindTarget(items: readonly OutlineItem[], query: TargetQuery): BindResult {
  if (query.uid !== undefined) {
    return { status: 'bound', uid: query.uid, candidates: [] }
  }
  if (query.name === undefined) {
    return none([])
  }
  const name = query.name
  let start = 0
  const near = query.near
  if (near !== undefined) {
    const fromNear = landmarkStart(items, near)
    if (typeof fromNear !== 'number') {
      return fromNear
    }
    start = fromNear
  }
  const windowItems: OutlineItem[] = []
  for (const [index, item] of items.entries()) {
    if (index >= start) {
      windowItems.push(item)
    }
  }
  const allowed = windowItems.filter((item) => roleAllowed(item, query))
  const hits = uniqueAtScore(allowed, (item) => controlScore(item, name, query.action))
  if (hits.length === 0) {
    return none(missPool(windowItems, query, name))
  }
  if (near !== undefined || overlayClones(hits)) {
    const nearest: OutlineItem[] = []
    for (const item of hits) {
      nearest.push(item)
      break
    }
    return pickUnique(nearest)
  }
  return pickUnique(hits)
}

/** Resolve an outline row. Unique bind or undefined. */
export function resolveTarget(
  items: readonly OutlineItem[],
  query: TargetQuery,
): string | undefined {
  return bindTarget(items, query).uid
}

function queryLabel(query: TargetQuery): string {
  const name = query.name
  const near = query.near
  if (name !== undefined && name !== '' && near !== undefined) {
    return `name=${name} near=${near}`
  }
  if (name !== undefined && name !== '') {
    return `name=${name}`
  }
  if (near !== undefined) {
    return `near=${near}`
  }
  return 'name='
}

/** Human-readable miss or tie, with a capped candidate list. */
export function formatBindFailure(query: TargetQuery, bind: BindResult): string {
  const action = query.action ?? 'target'
  const listed: string[] = []
  for (const item of bind.candidates) {
    if (listed.length >= BIND_CANDIDATE_LIMIT) {
      break
    }
    listed.push(`${item.role}:${item.name}`)
  }
  const kind = bind.status === 'ambiguous' ? 'ambiguous target' : 'no target'
  return `${kind} for ${action} ${queryLabel(query)} candidates=${listed.join(';')}`
}
