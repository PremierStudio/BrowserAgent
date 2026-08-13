import type { EventSource } from './EventCollector.js'

type Handler = (payload: unknown) => void

type Waiter = {
  event: string
  handler: Handler
}

/** An EventSource that queues listeners until a live browser source exists. */
export function createDeferredEventSource(): {
  source: EventSource
  attach: (live: EventSource) => void
} {
  const waiters: Waiter[] = []
  let live: EventSource | undefined

  return {
    source: {
      on(event, handler) {
        if (live !== undefined) {
          live.on(event, handler)
          return
        }
        waiters.push({ event, handler })
      },
    },
    attach(next) {
      if (live !== undefined) {
        return
      }
      live = next
      for (const waiter of waiters) {
        next.on(waiter.event, waiter.handler)
      }
      waiters.length = 0
    },
  }
}
