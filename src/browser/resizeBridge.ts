import type { EventSource } from '../events/EventCollector.js'
import { parseWindowLayout } from './windowLayout.js'

type Handler = (payload: unknown) => void
type EvaluateFn = (script: string) => Promise<unknown>
type ExposeFn = (name: string, fn: (payload: unknown) => void) => Promise<void>

/**
 * Page-side script that posts outer window + inner viewport on resize.
 * Idempotent so observe can re-run it after a navigation.
 */
export const INSTALL_RESIZE_LISTENER =
  '(function () { if (globalThis.__baResizeInstalled) { return } globalThis.__baResizeInstalled = true; const fire = function () { if (typeof globalThis.__baResize === "function") { globalThis.__baResize({ x: screenX, y: screenY, width: outerWidth, height: outerHeight, viewportWidth: innerWidth, viewportHeight: innerHeight }) } }; addEventListener("resize", fire) })()'

/**
 * In-memory EventSource that accepts ingest() calls from the page-side
 * resize hook and emits `resized` payloads.
 */
export function createResizeBridge(): {
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
    const parsed = parseWindowLayout(payload)
    if (parsed === undefined) {
      return
    }
    const list = handlers.get('resized')
    if (list === undefined) {
      return
    }
    for (const handler of list) {
      handler(parsed)
    }
  }

  return { source, ingest }
}

/** Exposes `__baResize` into the page, then evaluates the resize installer. */
export async function installResizeListener(
  evaluate: EvaluateFn,
  expose: ExposeFn,
  ingest: (payload: unknown) => void,
): Promise<void> {
  await expose('__baResize', ingest)
  await evaluate(INSTALL_RESIZE_LISTENER)
}
