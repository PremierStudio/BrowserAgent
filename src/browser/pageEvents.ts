import type { EventSource } from '../events/EventCollector.js'

/** A minimal structural view of a Puppeteer-like page emitter. */
export interface PageEventView {
  on(event: string, handler: (payload: unknown) => void): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDomPayload(value: unknown): value is { kind: string; target: string } {
  return isRecord(value) && typeof value.kind === 'string' && typeof value.target === 'string'
}

function readThunkString(value: typeof Function.prototype): string {
  try {
    const result = value()
    return typeof result === 'string' ? result : ''
  } catch {
    return ''
  }
}

function readThunkNumber(value: typeof Function.prototype): number {
  try {
    const result = value()
    return typeof result === 'number' ? result : 0
  } catch {
    return 0
  }
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  switch (typeof value) {
    case 'string':
      return value
    case 'function':
      return readThunkString(value)
    default:
      return ''
  }
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  switch (typeof value) {
    case 'number':
      return value
    case 'function':
      return readThunkNumber(value)
    default:
      return 0
  }
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
    try {
      const normalized = normalize(payload)
      if (normalized !== null) {
        handler(normalized)
      }
    } catch {
      // Live Puppeteer events must never crash the MCP stdio process.
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

/** Forwards EventSource.on to every inner source (console + DOM mutations). */
export function combineEventSources(...sources: EventSource[]): EventSource {
  return {
    on(event: string, handler: (payload: unknown) => void): void {
      for (const source of sources) {
        source.on(event, handler)
      }
    },
  }
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
