import { ActionLog } from '../actions/ActionLog.js'
import type { BrowserController } from '../browser/browserDesk.js'
import { createBrowserDesk } from '../browser/browserDesk.js'
import { emptyRegistry, serializeRegistry } from '../browser/instanceRegistry.js'
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
  controller?: BrowserController
}

/** The collaborators a default MCP server needs. */
interface Runtime {
  page: ContextPage | undefined
  store: TaskStore
  runner: TaskRunner
  events: EventBuffer
  actions: ActionLog
  controller: BrowserController
}

const DEFAULT_CAPACITY = 100

function defaultClock(): number {
  return Date.now()
}

/**
 * Assembles the in-process browser runtime: task store, event buffer,
 * action log, and an optional EventCollector attached to a page event source.
 */
function memoryStore() {
  let text = serializeRegistry(emptyRegistry())
  return {
    read: () => text,
    write: (next: string) => {
      text = next
    },
  }
}

function defaultController(clock: Clock): BrowserController {
  const desk = createBrowserDesk({
    id: 'runtime',
    mcpPid: 0,
    clock,
    isAlive: () => true,
    store: memoryStore(),
  })
  return {
    status: async () => desk.snapshot(),
    open: async () => {
      desk.markOpen(1, false, [])
      return desk.snapshot()
    },
    close: async () => {
      desk.markClosed()
      return desk.snapshot()
    },
    reap: async () => desk.snapshot(),
    newTab: async () => {
      desk.markOpen(1, false, [])
      return desk.snapshot()
    },
    closeTab: async () => desk.snapshot(),
    switchTab: async () => desk.snapshot(),
  }
}

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const capacity = options.capacity ?? DEFAULT_CAPACITY
  const events = new EventBuffer(capacity)
  const actions = new ActionLog(capacity)
  const store = new TaskStore()
  const runner = new TaskRunner(store)
  const clock = options.clock ?? defaultClock
  if (options.eventSource !== undefined) {
    new EventCollector(options.eventSource, events, clock).start()
  }
  return {
    page: options.page,
    store,
    runner,
    events,
    actions,
    controller: options.controller ?? defaultController(clock),
  }
}
