import { describe, expect, it } from 'vitest'
import { EventBuffer } from '../../src/events/EventBuffer.js'
import { EventCollector, type EventSource } from '../../src/events/EventCollector.js'
import {
  adaptPageEvents,
  adaptPageEventsFromUnknown,
  combineEventSources,
  type PageEventView,
} from '../../src/browser/pageEvents.js'

interface Handler {
  (payload: unknown): void
}

function makePage(): PageEventView & {
  emit: (event: string, payload: unknown) => void
  subscribed: string[]
} {
  const handlers = new Map<string, Handler[]>()
  const subscribed: string[] = []
  return {
    subscribed,
    on(event: string, handler: Handler): void {
      subscribed.push(event)
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

function listen(source: EventSource, event: string): unknown[] {
  const received: unknown[] = []
  source.on(event, (payload) => {
    received.push(payload)
  })
  return received
}

describe('adaptPageEvents', () => {
  describe('console', () => {
    it('normalizes a Puppeteer ConsoleMessage (type/text accessors) to strings', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'console')
      const payload = { type: () => 'error', text: () => 'boom' }
      page.emit('console', payload)
      expect(received).toEqual([{ type: 'error', text: 'boom' }])
      expect(received[0]).not.toBe(payload)
    })

    it('passes through a record payload { type, text }', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'console')
      page.emit('console', { type: 'warn', text: 'careful' })
      expect(received).toEqual([{ type: 'warn', text: 'careful' }])
    })

    it('passes the type() string through even when it is not a known console level', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'console')
      page.emit('console', { type: () => 'trace', text: () => 'stack' })
      expect(received).toEqual([{ type: 'trace', text: 'stack' }])
    })

    it('normalizes mixed accessor and record fields', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'console')
      page.emit('console', { type: 'debug', text: () => 'mixed' })
      page.emit('console', { type: () => 'info', text: 'also-mixed' })
      expect(received).toEqual([
        { type: 'debug', text: 'mixed' },
        { type: 'info', text: 'also-mixed' },
      ])
    })

    it('emits empty strings when record fields are missing or not strings', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'console')
      page.emit('console', {})
      page.emit('console', { type: 1, text: true })
      page.emit('console', { type: () => 9, text: () => ({}) })
      page.emit('console', { type: '', text: '' })
      expect(received).toEqual([
        { type: '', text: '' },
        { type: '', text: '' },
        { type: '', text: '' },
        { type: '', text: '' },
      ])
    })

    it('drops non-record console payloads', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'console')
      page.emit('console', null)
      page.emit('console', undefined)
      page.emit('console', 'log')
      page.emit('console', 1)
      page.emit('console', true)
      expect(received).toEqual([])
    })
  })

  describe('response', () => {
    it('normalizes a Puppeteer HTTPResponse (url/status accessors)', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'response')
      page.emit('response', { url: () => 'https://example.com', status: () => 201 })
      expect(received).toEqual([{ url: 'https://example.com', status: 201 }])
    })

    it('passes through a record payload { url, status }', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'response')
      page.emit('response', { url: 'https://example.com/ok', status: 200 })
      expect(received).toEqual([{ url: 'https://example.com/ok', status: 200 }])
    })

    it('normalizes mixed accessor and record fields', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'response')
      page.emit('response', { url: 'https://example.com/a', status: () => 204 })
      page.emit('response', { url: () => 'https://example.com/b', status: 301 })
      expect(received).toEqual([
        { url: 'https://example.com/a', status: 204 },
        { url: 'https://example.com/b', status: 301 },
      ])
    })

    it('uses empty url and status 0 when fields are missing or invalid', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'response')
      page.emit('response', {})
      page.emit('response', { url: 1, status: 'nope' })
      page.emit('response', { url: () => 1, status: () => 'nope' })
      page.emit('response', { url: '', status: 0 })
      expect(received).toEqual([
        { url: '', status: 0 },
        { url: '', status: 0 },
        { url: '', status: 0 },
        { url: '', status: 0 },
      ])
    })

    it('preserves a numeric status that is NaN', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'response')
      page.emit('response', { url: 'https://example.com', status: Number.NaN })
      page.emit('response', { url: 'https://example.com', status: () => Number.NaN })
      expect(received).toEqual([
        { url: 'https://example.com', status: Number.NaN },
        { url: 'https://example.com', status: Number.NaN },
      ])
    })

    it('drops non-record response payloads', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'response')
      page.emit('response', null)
      page.emit('response', 'https://example.com')
      expect(received).toEqual([])
    })
  })

  describe('requestfailed', () => {
    it('normalizes a Puppeteer HTTPRequest (url accessor) to { url }', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'requestfailed')
      page.emit('requestfailed', { url: () => 'https://example.com/fail' })
      expect(received).toEqual([{ url: 'https://example.com/fail' }])
    })

    it('passes through a record payload { url }', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'requestfailed')
      page.emit('requestfailed', { url: 'https://example.com/lost' })
      expect(received).toEqual([{ url: 'https://example.com/lost' }])
    })

    it('emits an empty url when the field is missing or invalid', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'requestfailed')
      page.emit('requestfailed', {})
      page.emit('requestfailed', { url: 1 })
      page.emit('requestfailed', { url: () => 1 })
      page.emit('requestfailed', { url: '' })
      expect(received).toEqual([{ url: '' }, { url: '' }, { url: '' }, { url: '' }])
    })

    it('does not attach a status field', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'requestfailed')
      page.emit('requestfailed', { url: 'https://example.com', status: 500 })
      expect(received).toEqual([{ url: 'https://example.com' }])
    })

    it('drops non-record requestfailed payloads', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'requestfailed')
      page.emit('requestfailed', null)
      expect(received).toEqual([])
    })
  })

  describe('framenavigated', () => {
    it('normalizes a Puppeteer Frame (url accessor) to { url }', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'framenavigated')
      page.emit('framenavigated', { url: () => 'https://example.com/page' })
      expect(received).toEqual([{ url: 'https://example.com/page' }])
    })

    it('passes through a record payload { url }', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'framenavigated')
      page.emit('framenavigated', { url: 'https://example.com/next' })
      expect(received).toEqual([{ url: 'https://example.com/next' }])
    })

    it('emits an empty url when the field is missing or invalid', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'framenavigated')
      page.emit('framenavigated', {})
      page.emit('framenavigated', { url: false })
      expect(received).toEqual([{ url: '' }, { url: '' }])
    })

    it('drops non-record framenavigated payloads', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'framenavigated')
      page.emit('framenavigated', undefined)
      expect(received).toEqual([])
    })
  })

  describe('dommutated', () => {
    it('forwards objects that already look like { kind, target }', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'dommutated')
      const payload = { kind: 'added', target: 'div#main' }
      page.emit('dommutated', payload)
      expect(received).toEqual([payload])
      expect(received[0]).toBe(payload)
    })

    it('forwards empty-string kind and target because they are still strings', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'dommutated')
      page.emit('dommutated', { kind: '', target: '' })
      expect(received).toEqual([{ kind: '', target: '' }])
    })

    it('drops payloads that do not look like { kind: string, target: string }', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'dommutated')
      page.emit('dommutated', null)
      page.emit('dommutated', {})
      page.emit('dommutated', { kind: 'added' })
      page.emit('dommutated', { target: 'div' })
      page.emit('dommutated', { kind: 1, target: 'div' })
      page.emit('dommutated', { kind: 'added', target: 1 })
      page.emit('dommutated', { kind: () => 'added', target: () => 'div' })
      expect(received).toEqual([])
    })
  })

  describe('subscription', () => {
    it('subscribes the page only when EventSource.on is called, using the same name', () => {
      const page = makePage()
      const source = adaptPageEvents(page)
      expect(page.subscribed).toEqual([])
      source.on('console', () => undefined)
      source.on('response', () => undefined)
      source.on('requestfailed', () => undefined)
      source.on('framenavigated', () => undefined)
      source.on('dommutated', () => undefined)
      expect(page.subscribed).toEqual([
        'console',
        'response',
        'requestfailed',
        'framenavigated',
        'dommutated',
      ])
    })

    it('does not subscribe the page to unknown EventSource names', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'unknown')
      expect(page.subscribed).toEqual([])
      page.emit('unknown', { type: 'log', text: 'nope' })
      page.emit('unknown', { kind: 'added', target: 'div' })
      expect(received).toEqual([])
    })

    it('does not deliver a page event to a listener registered for a different name', () => {
      const page = makePage()
      const received = listen(adaptPageEvents(page), 'console')
      page.emit('response', { url: 'https://example.com', status: 200 })
      expect(received).toEqual([])
    })
  })

  describe('combineEventSources', () => {
    it('delivers an event to a handler from every inner source', () => {
      const a = makePage()
      const b = makePage()
      const received: unknown[] = []
      combineEventSources(adaptPageEvents(a), adaptPageEvents(b)).on('console', (payload) => {
        received.push(payload)
      })
      a.emit('console', { type: 'log', text: 'a' })
      b.emit('console', { type: 'log', text: 'b' })
      expect(received).toEqual([
        { type: 'log', text: 'a' },
        { type: 'log', text: 'b' },
      ])
    })
  })

  describe('adaptPageEventsFromUnknown', () => {
    it('accepts a structural emitter and rejects a non-emitter', () => {
      const page = makePage()
      const received = listen(adaptPageEventsFromUnknown(page), 'console')
      page.emit('console', { type: 'log', text: 'hi' })
      expect(received).toEqual([{ type: 'log', text: 'hi' }])
      expect(() => adaptPageEventsFromUnknown({})).toThrow(/not a page event source/i)
      expect(() => adaptPageEventsFromUnknown(null)).toThrow(/not a page event source/i)
    })
  })

  describe('EventCollector integration', () => {
    it('delivers a normalized console message into the event buffer', () => {
      const page = makePage()
      const source = adaptPageEvents(page)
      const buffer = new EventBuffer(10)
      const collector = new EventCollector(source, buffer, () => 100)
      collector.start()
      page.emit('console', { type: () => 'error', text: () => 'boom' })
      expect(buffer.all()).toEqual([
        { type: 'console', timestamp: 100, level: 'error', text: 'boom' },
      ])
    })
  })
})
