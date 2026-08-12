import type { EventSource } from '../events/EventCollector.js'

interface DomMutationPayload {
  kind: string
  target: string
}

type Handler = (payload: unknown) => void

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMutationKind(value: unknown): value is 'added' | 'removed' | 'changed' {
  return value === 'added' || value === 'removed' || value === 'changed'
}

/** Returns a mutation record when kind is added/removed/changed and target is a string. */
export function parseMutationRecord(value: unknown): DomMutationPayload | null {
  if (!isRecord(value) || !isMutationKind(value.kind) || typeof value.target !== 'string') {
    return null
  }
  return { kind: value.kind, target: value.target }
}

/**
 * In-memory EventSource that accepts ingest() calls from a page-side
 * MutationObserver (or tests) and emits `dommutated` payloads.
 */
export function createDomMutationBridge(): {
  source: EventSource
  ingest: (payload: unknown) => void
} {
  const handlers = new Map<string, Handler[]>()

  const source: EventSource = {
    on(event: string, handler: Handler): void {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
    },
  }

  const ingest = (payload: unknown): void => {
    const parsed = parseMutationRecord(payload)
    if (parsed === null) {
      return
    }
    const list = handlers.get('dommutated')
    if (list === undefined) {
      return
    }
    for (const handler of list) {
      handler(parsed)
    }
  }

  return { source, ingest }
}

/**
 * Page-side script the parent evaluates to install a MutationObserver that
 * posts `dommutated` messages for added, removed, and attribute/text changes.
 */
export const INSTALL_MUTATION_OBSERVER =
  '(function () { const observer = new MutationObserver(function (records) { for (const record of records) { let kind = "changed"; if (record.type === "childList") { kind = record.addedNodes.length > 0 ? "added" : "removed" } const node = record.target; const target = node && node.nodeName ? String(node.nodeName) : ""; if (typeof globalThis.__baIngest === "function") { globalThis.__baIngest({ type: "dommutated", kind: kind, target: target }) } } }); observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true }) })()'

/** Expose + evaluate hooks used to install the observer on a live page. */
export type EvaluateFn = (script: string) => Promise<unknown>
export type ExposeFn = (name: string, fn: (payload: unknown) => void) => Promise<void>

/**
 * Exposes `__baIngest` into the page, then evaluates the MutationObserver
 * installer so live DOM changes call ingest.
 */
export async function installMutationObserver(
  evaluate: EvaluateFn,
  expose: ExposeFn,
  ingest: (payload: unknown) => void,
): Promise<void> {
  await expose('__baIngest', ingest)
  await evaluate(INSTALL_MUTATION_OBSERVER)
}
