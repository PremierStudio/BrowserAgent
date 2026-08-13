/** Timing Grok sees on every MCP tool result. */
export interface CallTrace {
  tool: string
  durationMs: number
  resultBytes: number
}

/** One recorded MCP tool call, including when it started. */
export interface CallRecord extends CallTrace {
  timestamp: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** JSON size of the payload that would be sent back to the host. */
export function resultBytes(value: unknown): number {
  return JSON.stringify(value).length
}

/** Attach a trace so Grok can see how long the call took and how large it was. */
export function attachTrace(result: unknown, trace: CallTrace): Record<string, unknown> {
  if (isRecord(result)) {
    return { ...result, trace }
  }
  return { value: result, trace }
}

/**
 * Bounded log of MCP tool calls. Oldest entries drop once capacity is exceeded.
 */
export class CallLog {
  private readonly capacity: number
  private entries: CallRecord[] = []

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error(`CallLog capacity must be positive, got ${capacity}`)
    }
    this.capacity = capacity
  }

  record(entry: CallRecord): void {
    this.entries.push(entry)
    if (this.entries.length > this.capacity) {
      this.entries.shift()
    }
  }

  all(): CallRecord[] {
    return [...this.entries]
  }
}
