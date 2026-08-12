import { describe, expect, it } from 'vitest'
import { ActionLog, type ActionEntry } from '../../src/actions/ActionLog.js'

function makeEntry(overrides: Partial<ActionEntry> = {}): ActionEntry {
  return {
    action: 'click',
    uid: 'loader-1_42',
    timestamp: 0,
    ...overrides,
  }
}

describe('ActionLog', () => {
  it('starts empty', () => {
    const log = new ActionLog(10)
    expect(log.all()).toEqual([])
  })

  it('records an action with uid and timestamp', () => {
    const log = new ActionLog(10)
    log.record(makeEntry({ action: 'click', uid: 'loader-1_42', timestamp: 100 }))
    expect(log.all()).toEqual([{ action: 'click', uid: 'loader-1_42', timestamp: 100 }])
  })

  it('records a box when present', () => {
    const log = new ActionLog(10)
    log.record(
      makeEntry({ action: 'click', uid: 'loader-1_42', box: { x: 1, y: 2, width: 3, height: 4 } }),
    )
    expect(log.all()[0]?.box).toEqual({ x: 1, y: 2, width: 3, height: 4 })
  })

  it('drops the oldest action when over capacity', () => {
    const log = new ActionLog(2)
    log.record(makeEntry({ action: 'click', timestamp: 1 }))
    log.record(makeEntry({ action: 'type', timestamp: 2 }))
    log.record(makeEntry({ action: 'hover', timestamp: 3 }))
    expect(log.all().map((e) => e.action)).toEqual(['type', 'hover'])
  })

  it('returns actions after a given timestamp', () => {
    const log = new ActionLog(10)
    log.record(makeEntry({ action: 'click', timestamp: 1 }))
    log.record(makeEntry({ action: 'type', timestamp: 5 }))
    log.record(makeEntry({ action: 'hover', timestamp: 10 }))
    expect(log.after(4).map((e) => e.action)).toEqual(['type', 'hover'])
  })

  it('clears all actions', () => {
    const log = new ActionLog(10)
    log.record(makeEntry({ action: 'click', timestamp: 1 }))
    log.clear()
    expect(log.all()).toEqual([])
  })

  it('rejects a zero capacity', () => {
    expect(() => new ActionLog(0)).toThrow(/capacity/i)
  })
})
