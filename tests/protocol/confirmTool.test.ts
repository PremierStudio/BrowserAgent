import { describe, expect, it } from 'vitest'
import { isInputRequiredResult } from '@modelcontextprotocol/server'
import { buildConfirmTool } from '../../src/protocol/confirmTool.js'

describe('buildConfirmTool', () => {
  it('is named confirm_action', () => {
    const tool = buildConfirmTool()
    expect(tool.name).toBe('confirm_action')
    expect(tool.description).toBe('Ask the user to confirm a potentially destructive action.')
    expect(tool.inputSchema.safeParse({ message: 'Submit payment?' }).success).toBe(true)
    expect(tool.inputSchema.safeParse({ message: 'x', requestState: 's' }).success).toBe(true)
    expect(
      tool.inputSchema.safeParse({ message: 'x', responses: { confirmed: true } }).success,
    ).toBe(true)
    expect(tool.inputSchema.safeParse({}).success).toBe(false)
    expect(tool.inputSchema.safeParse({ requestState: 's' }).success).toBe(false)
  })

  it('returns an input_required gate when the user has not confirmed', async () => {
    const result = await buildConfirmTool().handler(
      { message: 'Submit payment?' },
      { experimental: false },
    )
    expect(isInputRequiredResult(result)).toBe(true)
    expect(result).toMatchObject({
      resultType: 'input_required',
      requestState: 'Submit payment?',
      inputRequests: {
        confirm: {
          method: 'elicitation/create',
          params: {
            message: 'Submit payment?',
            mode: 'form',
            requestedSchema: {
              type: 'object',
              properties: { confirm: { type: 'boolean' } },
              required: ['confirm'],
            },
          },
        },
      },
    })
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
    const handler = buildConfirmTool().handler
    for (const args of [null, undefined, 1, 'nope', true, {}, { requestState: 's' }]) {
      await expect(handler(args, { experimental: false })).rejects.toThrow(/invalid args/i)
    }
  })
})
