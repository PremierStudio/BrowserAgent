import { describe, expect, it } from 'vitest'
import { buildTools } from '../../src/protocol/buildTools.js'
import type { ContextPage } from '../../src/context/ContextPage.js'

function recordPage(): ContextPage & { calls: string[] } {
  const calls: string[] = []
  const page = {
    calls,
    getElementByUid: async () => undefined,
    waitForEventsAfterAction: async () => undefined,
    observe: async () => ({
      snapshot: { uid: 'x', role: 'generic', name: '' },
      image: '',
      overlay: {},
    }),
    emulate: async () => undefined,
    getDialog: async () => null,
    click: async (uid: string) => {
      calls.push(`click:${uid}`)
    },
    type: async (uid: string, text: string) => {
      calls.push(`type:${uid}:${text}`)
    },
    hover: async (uid: string) => {
      calls.push(`hover:${uid}`)
    },
    scroll: async (uid: string, dx: number, dy: number) => {
      calls.push(`scroll:${uid}:${dx}:${dy}`)
    },
    select: async (uid: string, value: string) => {
      calls.push(`select:${uid}:${value}`)
    },
    press: async (key: string) => {
      calls.push(`press:${key}`)
    },
    navigate: async (url: string) => {
      calls.push(`navigate:${url}`)
    },
  }
  return page
}

function handlerFor(
  name: string,
):
  | ((args: unknown, ctx: { experimental: boolean; page?: unknown }) => Promise<unknown>)
  | undefined {
  return buildTools().find((t) => t.name === name)?.handler
}

describe('buildTools', () => {
  it('returns the observe tool and the action tools', () => {
    const names = buildTools().map((t) => t.name)
    expect(names).toEqual([
      'observe',
      'click',
      'type',
      'hover',
      'scroll',
      'select',
      'press',
      'navigate',
    ])
  })

  it('wires the observe tool to the page through the context', async () => {
    const page = recordPage()
    const result = await handlerFor('observe')?.({}, { experimental: false, page })
    expect(result).toEqual({
      snapshot: { uid: 'x', role: 'generic', name: '' },
      image: '',
      overlay: {},
    })
  })

  it('dispatches each action tool to its page method', async () => {
    const page = recordPage()
    const ctx = { experimental: false, page }
    await handlerFor('click')?.({ uid: '1' }, ctx)
    await handlerFor('type')?.({ uid: '1', text: 'hi' }, ctx)
    await handlerFor('hover')?.({ uid: '1' }, ctx)
    await handlerFor('scroll')?.({ uid: '1', dx: 1, dy: 2 }, ctx)
    await handlerFor('select')?.({ uid: '1', value: 'v' }, ctx)
    await handlerFor('press')?.({ key: 'Enter' }, ctx)
    await handlerFor('navigate')?.({ url: 'https://example.com' }, ctx)
    expect(page.calls).toEqual([
      'click:1',
      'type:1:hi',
      'hover:1',
      'scroll:1:1:2',
      'select:1:v',
      'press:Enter',
      'navigate:https://example.com',
    ])
  })

  it('returns ok for each action tool', async () => {
    const page = recordPage()
    const ctx = { experimental: false, page }
    expect(await handlerFor('click')?.({ uid: '1' }, ctx)).toEqual({ ok: true })
    expect(await handlerFor('navigate')?.({ url: 'https://example.com' }, ctx)).toEqual({
      ok: true,
    })
  })

  it('throws when a page tool is called without a page', async () => {
    await expect(handlerFor('click')?.({ uid: 'x' }, { experimental: false })).rejects.toThrow(
      /requires a page/i,
    )
  })

  it('throws when the page is a non-object', async () => {
    await expect(
      handlerFor('click')?.({ uid: 'x' }, { experimental: false, page: 'nope' }),
    ).rejects.toThrow(/requires a page/i)
  })

  it('throws when the page is an object without click', async () => {
    await expect(
      handlerFor('click')?.({ uid: 'x' }, { experimental: false, page: { foo: 1 } }),
    ).rejects.toThrow(/requires a page/i)
  })

  it('throws on invalid args', async () => {
    const page = recordPage()
    await expect(handlerFor('click')?.({}, { experimental: false, page })).rejects.toThrow(
      /invalid args/i,
    )
    await expect(handlerFor('type')?.({ uid: '1' }, { experimental: false, page })).rejects.toThrow(
      /invalid args/i,
    )
    await expect(
      handlerFor('scroll')?.({ uid: '1' }, { experimental: false, page }),
    ).rejects.toThrow(/invalid args/i)
    await expect(
      handlerFor('select')?.({ uid: '1' }, { experimental: false, page }),
    ).rejects.toThrow(/invalid args/i)
    await expect(handlerFor('press')?.({}, { experimental: false, page })).rejects.toThrow(
      /invalid args/i,
    )
    await expect(handlerFor('navigate')?.({}, { experimental: false, page })).rejects.toThrow(
      /invalid args/i,
    )
    await expect(handlerFor('hover')?.({}, { experimental: false, page })).rejects.toThrow(
      /invalid args/i,
    )
  })
})
