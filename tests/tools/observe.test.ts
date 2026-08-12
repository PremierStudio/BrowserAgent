import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { observeTool } from '../../src/tools/observe.js'
import { ToolCategory } from '../../src/tools/types.js'
import type { ContextPage } from '../../src/context/ContextPage.js'

function makeContextPage(overrides: Partial<ContextPage> = {}): ContextPage {
  return {
    getElementByUid: async () => undefined,
    waitForEventsAfterAction: async () => undefined,
    observe: async () => ({
      snapshot: { uid: 'loader-1_1', role: 'generic', name: '' },
      image: 'data:image/png;base64,abc',
      overlay: {},
    }),
    emulate: async () => undefined,
    getDialog: async () => null,
    ...overrides,
  }
}

describe('observeTool', () => {
  it('is a page tool in the observe category', () => {
    expect(observeTool.name).toBe('observe')
    expect(observeTool.category).toBe(ToolCategory.Observe)
    expect(observeTool.readOnly).toBe(true)
    expect(observeTool.experimental).toBe(false)
    expect(observeTool.description.length).toBeGreaterThan(0)
  })

  it('has a zod input schema', () => {
    expect(observeTool.inputSchema).toBeInstanceOf(z.ZodType)
  })

  it('returns the observe result from the context page', async () => {
    const page = makeContextPage()
    const result = await observeTool.handler({}, { experimental: false, page })
    expect(result).toEqual({
      snapshot: { uid: 'loader-1_1', role: 'generic', name: '' },
      image: 'data:image/png;base64,abc',
      overlay: {},
    })
  })

  it('throws when no page is provided', async () => {
    await expect(observeTool.handler({}, { experimental: false })).rejects.toThrow(
      /requires a page/i,
    )
  })

  it('throws when the page is not a ContextPage', async () => {
    await expect(
      observeTool.handler({}, { experimental: false, page: { notAContextPage: true } }),
    ).rejects.toThrow(/requires a ContextPage/i)
  })

  it('throws when the page is a non-object', async () => {
    await expect(
      observeTool.handler({}, { experimental: false, page: 'not-a-page' }),
    ).rejects.toThrow(/requires a ContextPage/i)
  })
})
