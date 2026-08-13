import { describe, expect, it } from 'vitest'
import { createDeferredEventSource } from '../../src/events/deferredSource.js'
import type { EventSource } from '../../src/events/EventCollector.js'

function recordSource(): EventSource & { handlers: Map<string, ((payload: unknown) => void)[]> } {
  const handlers = new Map<string, ((payload: unknown) => void)[]>()
  return {
    handlers,
    on(event, handler) {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
    },
  }
}

describe('createDeferredEventSource', () => {
  it('holds listeners until a live source is attached', () => {
    const deferred = createDeferredEventSource()
    const seen: string[] = []
    deferred.source.on('console', (payload) => {
      seen.push(String(payload))
    })
    const live = recordSource()
    deferred.attach(live)
    expect(live.handlers.size).toBe(1)
    const list = live.handlers.get('console') ?? []
    expect(list).toHaveLength(1)
    const first = list[0]
    expect(first).toBeDefined()
    if (first !== undefined) {
      first('hi')
    }
    expect(seen).toEqual(['hi'])
  })

  it('sends later listeners to the live source', () => {
    const deferred = createDeferredEventSource()
    const live = recordSource()
    deferred.attach(live)
    deferred.source.on('resized', () => undefined)
    expect(live.handlers.get('resized')).toHaveLength(1)
  })

  it('ignores a second attach so the first live source stays bound', () => {
    const deferred = createDeferredEventSource()
    const first = recordSource()
    const second = recordSource()
    deferred.source.on('console', () => undefined)
    deferred.attach(first)
    deferred.attach(second)
    deferred.source.on('resized', () => undefined)
    expect(first.handlers.get('console')).toHaveLength(1)
    expect(first.handlers.get('resized')).toHaveLength(1)
    expect(second.handlers.size).toBe(0)
  })
})
