import type { EventSource } from '../events/EventCollector.js'

/** A minimal structural view of a Puppeteer-like page emitter. */
export interface PageEventView {
  on(event: string, handler: (payload: unknown) => void): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isThunk(value: unknown): value is () => unknown {
  return typeof value === 'function'
}

function isDomPayload(value: unknown): value is { kind: string; target: string } {
  return isRecord(value) && typeof value.kind === 'string' && typeof value.target === 'string'
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value === 'string') {
    return value
  }
  if (isThunk(value)) {
    const result = value()
    if (typeof result === 'string') {
      return result
    }
  }
  return ''
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value === 'number') {
    return value
  }
  if (isThunk(value)) {
    const result = value()
    if (typeof result === 'number') {
      return result
    }
  }
  return 0
}

function normalizeConsole(payload: unknown): { type: string; text: string } | null {
  if (!isRecord(payload)) {
    return null
  }
  return { type: readString(payload, 'type'), text: readString(payload, 'text') }
}

function normalizeResponse(payload: unknown): { url: string; status: number } | null {
  if (!isRecord(payload)) {
    return null
  }
  return { url: readString(payload, 'url'), status: readNumber(payload, 'status') }
}

function normalizeUrl(payload: unknown): { url: string } | null {
  if (!isRecord(payload)) {
    return null
  }
  return { url: readString(payload, 'url') }
}

function subscribeNormalized(
  page: PageEventView,
  event: string,
  handler: (payload: unknown) => void,
  normalize: (payload: unknown) => unknown | null,
): void {
  page.on(event, (payload) => {
    const normalized = normalize(payload)
    if (normalized !== null) {
      handler(normalized)
    }
  })
}

function isPageEventView(value: unknown): value is PageEventView {
  return isRecord(value) && typeof value.on === 'function'
}

/**
 * Adapts an unknown page emitter (typically a real Puppeteer Page) after a
 * structural check, so the CLI can pass a live Page without type assertions.
 */
export function adaptPageEventsFromUnknown(page: unknown): EventSource {
  if (!isPageEventView(page)) {
    throw new Error('not a page event source')
  }
  return adaptPageEvents(page)
}

/**
 * Adapts a Puppeteer-like page emitter into the EventSource EventCollector
 * already understands. Accessor-shaped payloads (type()/url()/status()) are
 * flattened to string/number records; non-records are dropped.
 */
export function adaptPageEvents(page: PageEventView): EventSource {
  return {
    on(event: string, handler: (payload: unknown) => void): void {
      if (event === 'console') {
        subscribeNormalized(page, event, handler, normalizeConsole)
        return
      }
      if (event === 'response') {
        subscribeNormalized(page, event, handler, normalizeResponse)
        return
      }
      if (event === 'requestfailed') {
        subscribeNormalized(page, event, handler, normalizeUrl)
        return
      }
      if (event === 'framenavigated') {
        subscribeNormalized(page, event, handler, normalizeUrl)
        return
      }
      if (event === 'dommutated') {
        subscribeNormalized(page, event, handler, (payload) =>
          isDomPayload(payload) ? payload : null,
        )
      }
    },
  }
}
