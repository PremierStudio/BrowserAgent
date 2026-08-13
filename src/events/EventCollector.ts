import { parseWindowLayout } from '../browser/windowLayout.js'
import type { EventBuffer } from './EventBuffer.js'
import {
  normalizeConsole,
  normalizeDom,
  normalizeNavigation,
  normalizeNetwork,
  normalizeResize,
} from './normalize.js'
import type { ConsoleEvent, DomEvent } from './types.js'

/** A minimal structural view of the browser event source we subscribe to. */
export interface EventSource {
  on(event: string, handler: (payload: unknown) => void): void
}

/** A clock function returning the current timestamp. */
export type Clock = () => number

interface Payload {
  type?: string
  text?: string
  url?: string
  status?: number
  kind?: string
  target?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Narrows an ingest payload to the fields we copy. Exported for guard tests. */
export function asPayload(payload: unknown): Payload | null {
  if (!isRecord(payload)) {
    return null
  }
  const result: Payload = {}
  if (typeof payload.type === 'string') {
    result.type = payload.type
  }
  if (typeof payload.text === 'string') {
    result.text = payload.text
  }
  if (typeof payload.url === 'string') {
    result.url = payload.url
  }
  if (typeof payload.status === 'number') {
    result.status = payload.status
  }
  if (typeof payload.kind === 'string') {
    result.kind = payload.kind
  }
  if (typeof payload.target === 'string') {
    result.target = payload.target
  }
  return result
}

/**
 * Subscribes to browser events (console, network, navigation, DOM) and
 * normalizes them into an EventBuffer. The event source is structural so it
 * can be unit-tested without a real browser; the clock is injected so
 * timestamps are deterministic.
 */
export class EventCollector {
  private readonly source: EventSource
  private readonly buffer: EventBuffer
  private readonly clock: Clock
  private started = false

  constructor(source: EventSource, buffer: EventBuffer, clock: Clock) {
    this.source = source
    this.buffer = buffer
    this.clock = clock
  }

  start(): void {
    if (this.started) {
      return
    }
    this.started = true
    this.source.on('console', (payload) => this.onConsole(payload))
    this.source.on('response', (payload) => this.onResponse(payload))
    this.source.on('requestfailed', (payload) => this.onRequestFailed(payload))
    this.source.on('framenavigated', (payload) => this.onNavigated(payload))
    this.source.on('dommutated', (payload) => this.onDomMutated(payload))
    this.source.on('resized', (payload) => this.onResized(payload))
  }

  private onConsole(payload: unknown): void {
    const data = asPayload(payload)
    if (data === null) {
      return
    }
    const level: ConsoleEvent['level'] =
      data.type === 'error' || data.type === 'warn' || data.type === 'debug' ? data.type : 'log'
    this.buffer.push(normalizeConsole(level, data.text ?? '', this.clock()))
  }

  private onResponse(payload: unknown): void {
    const data = asPayload(payload)
    if (data === null) {
      return
    }
    this.buffer.push(normalizeNetwork(data.url ?? '', data.status ?? 0, false, this.clock()))
  }

  private onRequestFailed(payload: unknown): void {
    const data = asPayload(payload)
    if (data === null) {
      return
    }
    this.buffer.push(normalizeNetwork(data.url ?? '', 0, true, this.clock()))
  }

  private onNavigated(payload: unknown): void {
    const data = asPayload(payload)
    if (data === null) {
      return
    }
    this.buffer.push(normalizeNavigation(data.url ?? '', this.clock()))
  }

  private onDomMutated(payload: unknown): void {
    const data = asPayload(payload)
    if (data === null) {
      return
    }
    const kind: DomEvent['kind'] =
      data.kind === 'removed' || data.kind === 'changed' ? data.kind : 'added'
    this.buffer.push(normalizeDom(kind, data.target ?? '', this.clock()))
  }

  private onResized(payload: unknown): void {
    const layout = parseWindowLayout(payload)
    if (layout === undefined) {
      return
    }
    this.buffer.push(normalizeResize(layout, this.clock()))
  }
}
