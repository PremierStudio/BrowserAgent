import type { BoundingBox } from '../snapshot/a11ySnapshot.js'

/** A single recorded action, the seed of the replay. */
export interface ActionEntry {
  action: string
  uid: string
  box?: BoundingBox
  timestamp: number
}

/**
 * A bounded, in-memory log of semantic actions. Oldest entries are dropped
 * once capacity is exceeded. Timestamps are supplied by the caller (injected
 * clock), so the log is deterministic and testable without real timing.
 */
export class ActionLog {
  private readonly capacity: number
  private entries: ActionEntry[] = []

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error(`ActionLog capacity must be positive, got ${capacity}`)
    }
    this.capacity = capacity
  }

  record(entry: ActionEntry): void {
    this.entries.push(entry)
    if (this.entries.length > this.capacity) {
      this.entries.shift()
    }
  }

  /** Returns all recorded actions in order. */
  all(): ActionEntry[] {
    return [...this.entries]
  }

  /** Returns actions with timestamp strictly greater than `after`. */
  after(after: number): ActionEntry[] {
    return this.entries.filter((entry) => entry.timestamp > after)
  }

  clear(): void {
    this.entries = []
  }
}
