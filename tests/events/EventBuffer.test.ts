import { describe, expect, it } from 'vitest'
import { EventBuffer } from '../../src/events/EventBuffer.js'
import type { BrowserEvent, ConsoleEvent } from '../../src/events/types.js'

function makeEvent(overrides: Partial<ConsoleEvent> = {}): BrowserEvent {
  return {
    type: 'console',
    timestamp: 0,
    level: 'log',
    text: '',
    ...overrides,
  }
}

describe('EventBuffer', () => {
  it('starts empty', () => {
    const buffer = new EventBuffer(10)
    expect(buffer.all()).toEqual([])
  })

  it('appends events in order', () => {
    const buffer = new EventBuffer(10)
    buffer.push(makeEvent({ timestamp: 1 }))
    buffer.push(makeEvent({ timestamp: 2 }))
    expect(buffer.all().map((e) => e.timestamp)).toEqual([1, 2])
  })

  it('drops the oldest event when over capacity', () => {
    const buffer = new EventBuffer(2)
    buffer.push(makeEvent({ timestamp: 1 }))
    buffer.push(makeEvent({ timestamp: 2 }))
    buffer.push(makeEvent({ timestamp: 3 }))
    expect(buffer.all().map((e) => e.timestamp)).toEqual([2, 3])
  })

  it('clears all events', () => {
    const buffer = new EventBuffer(10)
    buffer.push(makeEvent({ timestamp: 1 }))
    buffer.clear()
    expect(buffer.all()).toEqual([])
  })

  it('returns events after a given timestamp', () => {
    const buffer = new EventBuffer(10)
    buffer.push(makeEvent({ timestamp: 1 }))
    buffer.push(makeEvent({ timestamp: 5 }))
    buffer.push(makeEvent({ timestamp: 10 }))
    expect(buffer.after(4).map((e) => e.timestamp)).toEqual([5, 10])
  })

  it('excludes events at the given timestamp (strictly after)', () => {
    const buffer = new EventBuffer(10)
    buffer.push(makeEvent({ timestamp: 1 }))
    buffer.push(makeEvent({ timestamp: 5 }))
    expect(buffer.after(5).map((e) => e.timestamp)).toEqual([])
  })

  it('returns an empty list when no events are after the timestamp', () => {
    const buffer = new EventBuffer(10)
    buffer.push(makeEvent({ timestamp: 1 }))
    expect(buffer.after(100)).toEqual([])
  })

  it('rejects a zero capacity', () => {
    expect(() => new EventBuffer(0)).toThrow(/capacity/i)
  })
})
