import { describe, expect, it } from 'vitest'
import { EventBuffer } from '../../src/events/EventBuffer.js'
import { asPayload, EventCollector, type EventSource } from '../../src/events/EventCollector.js'

interface Handler {
  (payload: unknown): void
}

function makeSource(): EventSource & { emit: (event: string, payload: unknown) => void } {
  const handlers = new Map<string, Handler[]>()
  return {
    on(event: string, handler: Handler): void {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
    },
    emit(event: string, payload: unknown): void {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload)
      }
    },
  }
}

describe('asPayload', () => {
  it('copies only string type and kind fields', () => {
    expect(asPayload({ type: 1, text: 'hi', kind: 4, target: 'div' })).toEqual({
      text: 'hi',
      target: 'div',
    })
    expect(asPayload({ type: 'error', kind: 'removed' })).toEqual({
      type: 'error',
      kind: 'removed',
    })
  })
})

describe('EventCollector', () => {
  it('collects console events', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 100)
    collector.start()
    source.emit('console', { type: 'error', text: 'boom' })
    expect(buffer.all()).toEqual([
      { type: 'console', timestamp: 100, level: 'error', text: 'boom' },
    ])
  })

  it('collects network response events', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 50)
    collector.start()
    source.emit('response', { url: 'https://example.com', status: 200 })
    expect(buffer.all()).toEqual([
      { type: 'network', timestamp: 50, url: 'https://example.com', status: 200, failed: false },
    ])
  })

  it('collects network failure events', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 50)
    collector.start()
    source.emit('requestfailed', { url: 'https://example.com' })
    expect(buffer.all()).toEqual([
      { type: 'network', timestamp: 50, url: 'https://example.com', status: 0, failed: true },
    ])
  })

  it('collects navigation events', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 200)
    collector.start()
    source.emit('framenavigated', { url: 'https://example.com/page' })
    expect(buffer.all()).toEqual([
      { type: 'navigation', timestamp: 200, url: 'https://example.com/page' },
    ])
  })

  it('collects DOM mutation events', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 10)
    collector.start()
    source.emit('dommutated', { kind: 'added', target: 'div#main' })
    expect(buffer.all()).toEqual([
      { type: 'dom', timestamp: 10, kind: 'added', target: 'div#main' },
    ])
  })

  it('does not collect events before start()', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    source.emit('console', { type: 'log', text: 'ignored' })
    expect(buffer.all()).toEqual([])
  })

  it('uses the injected clock for timestamps', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    let now = 0
    const collector = new EventCollector(source, buffer, () => now)
    collector.start()
    now = 42
    source.emit('console', { type: 'log', text: 'hi' })
    expect(buffer.all()[0]?.timestamp).toBe(42)
  })

  it('ignores non-object payloads', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 100)
    collector.start()
    source.emit('console', 'not-an-object')
    source.emit('console', null)
    source.emit('response', 'not-an-object')
    source.emit('requestfailed', 'not-an-object')
    source.emit('framenavigated', 'not-an-object')
    source.emit('dommutated', 'not-an-object')
    source.emit('resized', 'not-an-object')
    source.emit('resized', {})
    expect(buffer.all()).toEqual([])
  })

  it('collects resize events from a live window layout', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 7)
    collector.start()
    source.emit('resized', {
      x: 0,
      y: 40,
      width: 1600,
      height: 900,
      viewportWidth: 1580,
      viewportHeight: 840,
    })
    expect(buffer.all()).toEqual([
      {
        type: 'resize',
        timestamp: 7,
        width: 1600,
        height: 900,
        viewportWidth: 1580,
        viewportHeight: 840,
      },
    ])
  })

  it('does not duplicate subscriptions when start() is called twice', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 100)
    collector.start()
    collector.start()
    source.emit('console', { type: 'log', text: 'once' })
    expect(buffer.all()).toHaveLength(1)
  })

  it('maps console warn and debug levels', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 100)
    collector.start()
    source.emit('console', { type: 'warn', text: 'w' })
    source.emit('console', { type: 'debug', text: 'd' })
    const levels = buffer.all().map((e) => (e.type === 'console' ? e.level : undefined))
    expect(levels).toEqual(['warn', 'debug'])
  })

  it('defaults an unknown console type to log', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 100)
    collector.start()
    source.emit('console', { type: 'trace', text: 't' })
    const first = buffer.all()[0]
    expect(first?.type === 'console' ? first.level : undefined).toBe('log')
  })

  it('maps dom removed and changed kinds', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 100)
    collector.start()
    source.emit('dommutated', { kind: 'removed', target: 'p' })
    source.emit('dommutated', { kind: 'changed', target: 'input' })
    const kinds = buffer.all().map((e) => (e.type === 'dom' ? e.kind : undefined))
    expect(kinds).toEqual(['removed', 'changed'])
  })

  it('defaults an unknown dom kind to added', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 100)
    collector.start()
    source.emit('dommutated', { kind: 'moved', target: 'div' })
    const first = buffer.all()[0]
    expect(first?.type === 'dom' ? first.kind : undefined).toBe('added')
  })

  it('defaults missing payload fields', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 100)
    collector.start()
    source.emit('console', {})
    source.emit('response', {})
    source.emit('requestfailed', {})
    source.emit('framenavigated', {})
    source.emit('dommutated', {})
    expect(buffer.all()).toEqual([
      { type: 'console', timestamp: 100, level: 'log', text: '' },
      { type: 'network', timestamp: 100, url: '', status: 0, failed: false },
      { type: 'network', timestamp: 100, url: '', status: 0, failed: true },
      { type: 'navigation', timestamp: 100, url: '' },
      { type: 'dom', timestamp: 100, kind: 'added', target: '' },
    ])
  })

  it('ignores payload fields of the wrong runtime type', () => {
    const source = makeSource()
    const buffer = new EventBuffer(10)
    const collector = new EventCollector(source, buffer, () => 100)
    collector.start()
    source.emit('console', { type: 1, text: 2 })
    source.emit('response', { url: 3, status: '200' })
    source.emit('requestfailed', { url: true })
    source.emit('framenavigated', { url: { href: 'x' } })
    source.emit('dommutated', { kind: 4, target: 5 })
    expect(buffer.all()).toEqual([
      { type: 'console', timestamp: 100, level: 'log', text: '' },
      { type: 'network', timestamp: 100, url: '', status: 0, failed: false },
      { type: 'network', timestamp: 100, url: '', status: 0, failed: true },
      { type: 'navigation', timestamp: 100, url: '' },
      { type: 'dom', timestamp: 100, kind: 'added', target: '' },
    ])
  })
})
