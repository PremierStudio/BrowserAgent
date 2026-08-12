import type { BoundingBox } from '../snapshot/a11ySnapshot.js'
import type { ActionLog } from './ActionLog.js'
import type { Clock } from './StabilityWaiter.js'

/** A waiter that resolves true when the DOM is stable, false on timeout. */
export interface StabilityWait {
  wait(): Promise<boolean>
}

/**
 * Orchestrates a single action: performs it, waits for DOM stability
 * (act-then-wait), and records it to the semantic action log. The clock is
 * injected so timestamps are deterministic.
 */
export class ActionRunner {
  private readonly log: ActionLog
  private readonly clock: Clock
  private readonly wait: StabilityWait

  constructor(log: ActionLog, wait: StabilityWait, clock: Clock) {
    this.log = log
    this.wait = wait
    this.clock = clock
  }

  /**
   * Runs an action. Returns true when the DOM stabilized, false on a
   * stability timeout. The action is logged regardless of the wait outcome.
   */
  async run(
    action: string,
    uid: string,
    perform: () => Promise<void>,
    box?: BoundingBox,
  ): Promise<boolean> {
    await perform()
    const stable = await this.wait.wait()
    const entry: { action: string; uid: string; box?: BoundingBox; timestamp: number } = {
      action,
      uid,
      timestamp: this.clock(),
    }
    if (box !== undefined) {
      entry.box = box
    }
    this.log.record(entry)
    return stable
  }
}
