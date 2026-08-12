import { describe, expect, it } from 'vitest'
import { isInputRequiredResult } from '@modelcontextprotocol/server'
import { buildConfirmTool } from '../../src/protocol/confirmTool.js'

describe('buildConfirmTool', () => {
  it('is named confirm_action', () => {
    expect(buildConfirmTool().name).toBe('confirm_action')
  })

  it('returns an input_required gate when the user has not confirmed', async () => {
    const result = await buildConfirmTool().handler(
      { message: 'Submit payment?' },
      { experimental: false },
    )
    expect(isInputRequiredResult(result)).toBe(true)
  })

  it('uses the provided requestState', async () => {
    const result = await buildConfirmTool().handler(
      { message: 'Submit payment?', requestState: 'pay-1' },
      { experimental: false },
    )
    expect(result).toMatchObject({ requestState: 'pay-1' })
  })

  it('returns ok when the fallback confirmed flag is set', async () => {
    const result = await buildConfirmTool().handler(
      { message: 'Submit payment?', responses: { confirmed: true } },
      { experimental: false },
    )
    expect(result).toEqual({ ok: true, confirmed: true })
  })

  it('throws on invalid args', async () => {
    await expect(buildConfirmTool().handler({}, { experimental: false })).rejects.toThrow(
      /invalid args/i,
    )
  })
})
