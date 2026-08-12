import { ActionLog } from '../actions/ActionLog.js'
import { ActionRunner } from '../actions/ActionRunner.js'
import type { ContextPage, ObserveResult } from '../context/ContextPage.js'
import { DiffTracker } from '../diff/DiffTracker.js'
import type { DiffResult } from '../diff/diff.js'
import { EventBuffer } from '../events/EventBuffer.js'
import type { BrowserEvent } from '../events/types.js'

/** observe() plus the session-owned diff and recent events. */
export interface SessionObserveResult extends ObserveResult {
  diff: DiffResult
  events: BrowserEvent[]
}

/** Injected collaborators for a session. */
export interface SessionOptions {
  tracker?: DiffTracker
  events?: EventBuffer
  log?: ActionLog
  clock?: () => number
}

const OWNER = 'session'

/**
 * Composition root for one browser tab: wraps a ContextPage with the diff
 * tracker, event buffer, and act-then-wait action runner so observe returns
 * changes (not dumps) and every write is logged.
 */
export class BrowserSession implements ContextPage {
  private readonly page: ContextPage
  private readonly tracker: DiffTracker
  private readonly events: EventBuffer
  private readonly log: ActionLog
  private readonly runner: ActionRunner

  constructor(page: ContextPage, options: SessionOptions = {}) {
    this.page = page
    this.tracker = options.tracker ?? new DiffTracker(OWNER)
    this.events = options.events ?? new EventBuffer(100)
    this.log = options.log ?? new ActionLog(100)
    this.runner = new ActionRunner(this.log, { wait: async () => true }, options.clock ?? (() => 0))
  }

  get actionLog(): ActionLog {
    return this.log
  }

  async observe(): Promise<SessionObserveResult> {
    const result = await this.page.observe()
    return {
      ...result,
      diff: this.tracker.observe(OWNER, result.snapshot),
      events: this.events.all(),
    }
  }

  async getElementByUid(uid: string): Promise<unknown> {
    return this.page.getElementByUid(uid)
  }

  async waitForEventsAfterAction(): Promise<void> {
    return this.page.waitForEventsAfterAction()
  }

  async emulate(options: unknown): Promise<void> {
    return this.page.emulate(options)
  }

  async getDialog(): Promise<unknown> {
    return this.page.getDialog()
  }

  async click(uid: string): Promise<void> {
    await this.runner.run('click', uid, () => this.page.click(uid))
  }

  async type(uid: string, text: string): Promise<void> {
    await this.runner.run('type', uid, () => this.page.type(uid, text))
  }

  async hover(uid: string): Promise<void> {
    await this.runner.run('hover', uid, () => this.page.hover(uid))
  }

  async scroll(uid: string, dx: number, dy: number): Promise<void> {
    await this.runner.run('scroll', uid, () => this.page.scroll(uid, dx, dy))
  }

  async select(uid: string, value: string): Promise<void> {
    await this.runner.run('select', uid, () => this.page.select(uid, value))
  }

  async press(key: string): Promise<void> {
    await this.runner.run('press', key, () => this.page.press(key))
  }

  async navigate(url: string): Promise<void> {
    await this.runner.run('navigate', url, () => this.page.navigate(url))
  }
}
