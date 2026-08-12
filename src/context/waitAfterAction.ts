import {
  StabilityWaiter,
  type MutationSource,
  type Clock,
  type Sleep,
} from '../actions/StabilityWaiter.js'

/** Options controlling the post-action DOM stability wait. */
export interface WaitAfterActionOptions {
  quietPeriod: number
  timeout: number
  throttle?: number
  clock?: Clock
  sleep?: Sleep
}

/** The default real-timer clock used when none is injected. */
export function defaultClock(): number {
  return Date.now()
}

/**
 * An in-memory MutationSource for tests (and any caller that needs to
 * drive mutations by hand). emit() invokes every registered listener.
 */
export function memoryMutationSource(): MutationSource & { emit: () => void } {
  const listeners: Array<() => void> = []
  return {
    onMutation(fn: () => void): void {
      listeners.push(fn)
    },
    emit(): void {
      for (const fn of listeners) {
        fn()
      }
    },
  }
}

/**
 * Builds a StabilityWaiter bound to the given mutation source and options.
 * wait() resolves true when the DOM is quiet, or false on timeout.
 */
export function createActionWaiter(
  source: MutationSource,
  options: WaitAfterActionOptions,
): { wait: () => Promise<boolean> } {
  const waiter = new StabilityWaiter(
    source,
    {
      quietPeriod: options.quietPeriod,
      timeout: options.timeout,
      throttle: options.throttle,
    },
    options.clock ?? defaultClock,
  )
  return {
    wait(): Promise<boolean> {
      return waiter.wait(options.sleep)
    },
  }
}
