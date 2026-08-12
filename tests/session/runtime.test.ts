import { describe, expect, it } from 'vitest'
import { createRuntime } from '../../src/session/runtime.js'
import type { ContextPage } from '../../src/context/ContextPage.js'
import type { EventSource } from '../../src/events/EventCollector.js'

function fakePage(): ContextPage {
  return {
    getElementByUid: async () => undefined,
    waitForEventsAfterAction: async () => undefined,
    observe: async () => ({
      snapshot: { uid: 'x', role: 'generic', name: '' },
      image: '',
      overlay: {},
      pageState: { url: '', title: '' },
    }),
    emulate: async () => undefined,
    getDialog: async () => null,
    click: async () => undefined,
    type: async () => undefined,
    hover: async () => undefined,
    scroll: async () => undefined,
    select: async () => undefined,
    press: async () => undefined,
    navigate: async () => undefined,
  }
}

function fakeSource(): EventSource & { emit: (event: string, payload: unknown) => void } {
  const handlers = new Map<string, ((payload: unknown) => void)[]>()
  return {
    on(event, handler) {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
    },
    emit(event, payload) {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload)
      }
    },
  }
}

describe('createRuntime', () => {
  it('creates a store, runner, event buffer, and action log', () => {
    const runtime = createRuntime()
    expect(runtime.store.list()).toEqual([])
    expect(runtime.events.all()).toEqual([])
    expect(runtime.actions.all()).toEqual([])
    expect(runtime.page).toBeUndefined()
  })

  it('holds the provided page', () => {
    const page = fakePage()
    const runtime = createRuntime({ page })
    expect(runtime.page).toBe(page)
  })

  it('starts an EventCollector when an event source is provided', () => {
    const source = fakeSource()
    const runtime = createRuntime({ eventSource: source, clock: () => 7 })
    source.emit('console', { type: 'error', text: 'boom' })
    expect(runtime.events.all()).toEqual([
      { type: 'console', timestamp: 7, level: 'error', text: 'boom' },
    ])
  })

  it('does not collect events when no source is provided', () => {
    const runtime = createRuntime({ clock: () => 1 })
    expect(runtime.events.all()).toEqual([])
  })

  it('uses the default clock when a source is provided without one', () => {
    const source = fakeSource()
    const runtime = createRuntime({ eventSource: source })
    source.emit('console', { type: 'log', text: 'hi' })
    const event = runtime.events.all()[0]
    expect(event?.type).toBe('console')
    if (event !== undefined && event.type === 'console') {
      expect(event.timestamp).toBeGreaterThan(0)
    }
  })

  it('honors a custom buffer capacity', () => {
    const source = fakeSource()
    const runtime = createRuntime({ eventSource: source, clock: () => 1, capacity: 1 })
    source.emit('console', { type: 'log', text: 'a' })
    source.emit('console', { type: 'log', text: 'b' })
    expect(runtime.events.all()).toHaveLength(1)
    expect(runtime.events.all()[0]).toMatchObject({ text: 'b' })
  })
})
