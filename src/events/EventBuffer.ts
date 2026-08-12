import type { BrowserEvent } from './types.js'

/**
 * A bounded, in-memory buffer of browser events. Oldest events are dropped
 * once capacity is exceeded, keeping memory bounded. Timestamps are supplied
 * by the caller (injected clock), so the buffer is deterministic and testable
 * without real timing.
 */
export class EventBuffer {
  private readonly capacity: number
  private events: BrowserEvent[] = []

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error(`EventBuffer capacity must be positive, got ${capacity}`)
    }
    this.capacity = capacity
  }

  push(event: BrowserEvent): void {
    this.events.push(event)
    if (this.events.length > this.capacity) {
      this.events.shift()
    }
  }

  /** Returns all buffered events in insertion order. */
  all(): BrowserEvent[] {
    return [...this.events]
  }

  /** Returns events with timestamp strictly greater than `after`. */
  after(after: number): BrowserEvent[] {
    return this.events.filter((event) => event.timestamp > after)
  }

  clear(): void {
    this.events = []
  }
}
