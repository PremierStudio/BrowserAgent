import { describe, expect, it } from 'vitest'
import { isInputRequiredResult } from '@modelcontextprotocol/server'
import { confirmGate, isConfirmed } from '../../src/protocol/mrtr.js'
import { toCallToolResult } from '../../src/protocol/tools.js'

describe('confirmGate', () => {
  it('returns an input_required result with the confirmation elicit', () => {
    const result = confirmGate('Submit payment?', 'state-1')
    expect(isInputRequiredResult(result)).toBe(true)
    expect(result).toMatchObject({
      resultType: 'input_required',
      requestState: 'state-1',
    })
  })

  it('embeds an elicit request keyed as confirm', () => {
    const result = confirmGate('Submit payment?', 'state-1')
    const requests = result.inputRequests
    expect(requests).toBeDefined()
    expect(requests).toHaveProperty('confirm')
  })
})

describe('isConfirmed', () => {
  it('returns true when the confirm content is accepted as true', () => {
    expect(isConfirmed({ confirm: { action: 'accept', content: { confirm: true } } })).toBe(true)
  })

  it('returns false when confirm is missing', () => {
    expect(isConfirmed(undefined)).toBe(false)
    expect(isConfirmed({})).toBe(false)
  })

  it('returns false when confirm is declined', () => {
    expect(isConfirmed({ confirm: { action: 'decline' } })).toBe(false)
  })

  it('returns false when confirm content is not true', () => {
    expect(isConfirmed({ confirm: { action: 'accept', content: { confirm: false } } })).toBe(false)
  })

  it('returns true for the fallback { confirmed: true } shape', () => {
    expect(isConfirmed({ confirmed: true })).toBe(true)
  })

  it('returns false for the fallback { confirmed: false } shape', () => {
    expect(isConfirmed({ confirmed: false })).toBe(false)
  })
})

describe('toCallToolResult', () => {
  it('wraps a plain result as structured content', () => {
    expect(toCallToolResult({ ok: true })).toEqual({
      content: [{ type: 'text', text: '{"ok":true}' }],
      structuredContent: { ok: true },
    })
  })

  it('passes an input_required result through unchanged', () => {
    const gate = confirmGate('ok?', 's')
    expect(toCallToolResult(gate)).toBe(gate)
  })

  it('wraps a primitive result under a value key', () => {
    expect(toCallToolResult('pong')).toEqual({
      content: [{ type: 'text', text: '"pong"' }],
      structuredContent: { value: 'pong' },
    })
  })

  it('wraps an array result under a value key', () => {
    expect(toCallToolResult([1, 2])).toEqual({
      content: [{ type: 'text', text: '[1,2]' }],
      structuredContent: { value: [1, 2] },
    })
  })

  it('wraps null under a value key', () => {
    expect(toCallToolResult(null)).toEqual({
      content: [{ type: 'text', text: 'null' }],
      structuredContent: { value: null },
    })
  })
})
