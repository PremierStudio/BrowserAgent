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
    ...overrides,
  }
}

describe('observeTool', () => {
  it('is a page tool in the observe category', () => {
    expect(observeTool.name).toBe('observe')
    expect(observeTool.category).toBe(ToolCategory.Observe)
    expect(observeTool.readOnly).toBe(true)
    expect(observeTool.experimental).toBe(false)
    expect(observeTool.description).toMatch(/outline/i)
    expect(observeTool.description).toMatch(/run_flow/i)
  })

  it('has a zod input schema', () => {
    expect(observeTool.inputSchema).toBeInstanceOf(z.ZodType)
  })

  it('returns the full observe result when args are not a record', async () => {
    const page = makeContextPage()
    const expected = {
      snapshot: { uid: 'loader-1_1', role: 'generic', name: '' },
      image: 'data:image/png;base64,abc',
      overlay: {},
      pageState: { url: '', title: '' },
    }
    await expect(observeTool.handler(null, { experimental: false, page })).resolves.toEqual(
      expected,
    )
    await expect(observeTool.handler(undefined, { experimental: false, page })).resolves.toEqual(
      expected,
    )
    await expect(observeTool.handler(1, { experimental: false, page })).resolves.toEqual(expected)
  })

  it('returns the observe result from the context page', async () => {
    const page = makeContextPage()
    const result = await observeTool.handler({}, { experimental: false, page })
    expect(result).toEqual({
      snapshot: { uid: 'loader-1_1', role: 'generic', name: '' },
      image: 'data:image/png;base64,abc',
      overlay: {},
      pageState: { url: '', title: '' },
    })
  })

  it('returns a compact outline without screenshot when detail is outline', async () => {
    const page = makeContextPage({
      observe: async () => ({
        snapshot: {
          uid: 'root',
          role: 'RootWebArea',
          name: 'Home',
          children: [
            { uid: 'h', role: 'heading', name: 'Hero' },
            { uid: 'btn', role: 'button', name: 'Go' },
          ],
        },
        image: 'data:image/png;base64,HUGE',
        overlay: { btn: { x: 1, y: 2, width: 3, height: 4 } },
        pageState: { url: 'https://example.com', title: 'Home' },
      }),
    })
    const result = await observeTool.handler({ detail: 'outline' }, { experimental: false, page })
    expect(result).toEqual({
      pageState: { url: 'https://example.com', title: 'Home' },
      outline: [
        { uid: 'h', role: 'heading', name: 'Hero' },
        { uid: 'btn', role: 'button', name: 'Go', context: 'Hero' },
      ],
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

  it('throws when the page is null', async () => {
    await expect(observeTool.handler({}, { experimental: false, page: null })).rejects.toThrow(
      'observe requires a ContextPage',
    )
  })

  it('throws when the page has observe but it is not a function', async () => {
    await expect(
      observeTool.handler({}, { experimental: false, page: { observe: 1 } }),
    ).rejects.toThrow('observe requires a ContextPage')
    await expect(
      observeTool.handler({}, { experimental: false, page: { observe: null } }),
    ).rejects.toThrow('observe requires a ContextPage')
  })
})
