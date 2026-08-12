/** A source of DOM mutation notifications. */
export interface MutationSource {
  onMutation(fn: () => void): void
}

/** A sleep function that resolves after `ms` (injected for determinism). */
export type Sleep = (ms: number) => Promise<void>

/** A clock function returning the current timestamp. */
export type Clock = () => number

/** Options controlling the stability wait. */
export interface StabilityOptions {
  quietPeriod: number
  timeout: number
  throttle?: number
}

/** The outcome of a stability check. */
export type StabilityStatus = 'stable' | 'timeout' | 'waiting'

const DEFAULT_POLL = 20

/** The default real-timer sleep used when no sleep is injected. */
export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Waits for the DOM to be stable (no mutations for a quiet period) or a
 * timeout, whichever comes first. The clock is injected so the logic is
 * deterministic and testable without real timing. A throttling multiplier
 * scales the quiet period (e.g. under CPU/network throttling).
 */
export class StabilityWaiter {
  private readonly source: MutationSource
  private readonly options: StabilityOptions
  private readonly clock: Clock
  private lastMutation: number | undefined
  private start: number | undefined

  constructor(source: MutationSource, options: StabilityOptions, clock: Clock) {
    this.source = source
    this.options = options
    this.clock = clock
    this.source.onMutation(() => {
      this.lastMutation = this.clock()
    })
  }

  /** Pure decision: the stability status at a given time. */
  check(now: number): StabilityStatus {
    if (this.start === undefined) {
      this.start = now
    }
    const quiet = this.options.quietPeriod * (this.options.throttle ?? 1)
    // No mutation ever observed means the DOM is already stable.
    if (this.lastMutation === undefined || now - this.lastMutation >= quiet) {
      return 'stable'
    }
    if (now - this.start >= this.options.timeout) {
      return 'timeout'
    }
    return 'waiting'
  }

  /** Waits for stability, resolving true when stable or false on timeout. */
  async wait(sleep: Sleep = defaultSleep): Promise<boolean> {
    for (;;) {
      const status = this.check(this.clock())
      if (status === 'stable') {
        return true
      }
      if (status === 'timeout') {
        return false
      }
      await sleep(DEFAULT_POLL)
    }
  }
}
