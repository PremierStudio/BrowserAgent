import { ActionLog } from '../actions/ActionLog.js'
import type { ContextPage } from '../context/ContextPage.js'
import { EventBuffer } from '../events/EventBuffer.js'
import { EventCollector, type EventSource } from '../events/EventCollector.js'
import { TaskRunner } from '../tasks/TaskRunner.js'
import { TaskStore } from '../tasks/TaskStore.js'

/** A clock function returning the current timestamp. */
type Clock = () => number

/** Options for assembling a server runtime. */
export interface RuntimeOptions {
  page?: ContextPage
  eventSource?: EventSource
  clock?: Clock
  capacity?: number
}

/** The collaborators a default MCP server needs. */
interface Runtime {
  page: ContextPage | undefined
  store: TaskStore
  runner: TaskRunner
  events: EventBuffer
  actions: ActionLog
}

const DEFAULT_CAPACITY = 100

function defaultClock(): number {
  return Date.now()
}

/**
 * Assembles the in-process browser runtime: task store, event buffer,
 * action log, and an optional EventCollector attached to a page event source.
 */
export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const capacity = options.capacity ?? DEFAULT_CAPACITY
  const events = new EventBuffer(capacity)
  const actions = new ActionLog(capacity)
  const store = new TaskStore()
  const runner = new TaskRunner(store)
  if (options.eventSource !== undefined) {
    new EventCollector(options.eventSource, events, options.clock ?? defaultClock).start()
  }
  return {
    page: options.page,
    store,
    runner,
    events,
    actions,
  }
}
