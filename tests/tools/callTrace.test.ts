import { describe, expect, it } from 'vitest'
import { CallLog, attachTrace, resultBytes, type CallTrace } from '../../src/tools/callTrace.js'

function sample(): CallTrace {
  return { tool: 'observe', durationMs: 12, resultBytes: 40 }
}

describe('resultBytes', () => {
  it('counts the JSON size of the value Grok would receive', () => {
    expect(resultBytes({ ok: true })).toBe(JSON.stringify({ ok: true }).length)
    expect(resultBytes('pong')).toBe(JSON.stringify('pong').length)
  })
})

describe('attachTrace', () => {
  it('adds trace onto an object result without dropping fields', () => {
    expect(attachTrace({ ok: true }, sample())).toEqual({
      ok: true,
      trace: sample(),
    })
  })

  it('wraps a non-object result so the trace still reaches Grok', () => {
    expect(attachTrace('pong', sample())).toEqual({
      value: 'pong',
      trace: sample(),
    })
    expect(attachTrace(['a'], sample())).toEqual({
      value: ['a'],
      trace: sample(),
    })
    expect(attachTrace(null, sample())).toEqual({
      value: null,
      trace: sample(),
    })
  })
})

describe('CallLog', () => {
  it('records calls in order and drops the oldest past capacity', () => {
    const log = new CallLog(2)
    log.record({ tool: 'a', durationMs: 1, resultBytes: 2, timestamp: 10 })
    log.record({ tool: 'b', durationMs: 3, resultBytes: 4, timestamp: 20 })
    log.record({ tool: 'c', durationMs: 5, resultBytes: 6, timestamp: 30 })
    expect(log.all()).toEqual([
      { tool: 'b', durationMs: 3, resultBytes: 4, timestamp: 20 },
      { tool: 'c', durationMs: 5, resultBytes: 6, timestamp: 30 },
    ])
  })

  it('rejects a non-positive capacity', () => {
    expect(() => new CallLog(0)).toThrow(/positive/i)
    expect(() => new CallLog(-1)).toThrow(/positive/i)
  })
})
