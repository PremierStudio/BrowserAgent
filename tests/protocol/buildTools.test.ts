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
      pageState: { url: '', title: '' },
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

function toolNamed(name: string) {
  const tool = buildTools().find((t) => t.name === name)
  expect(tool).toBeDefined()
  return tool
}

async function expectInvalidArgs(
  name: string,
  args: unknown,
  page: ContextPage = recordPage(),
): Promise<void> {
  await expect(handlerFor(name)?.(args, { experimental: false, page })).rejects.toThrow(
    /invalid args/i,
  )
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

  it('advertises exact descriptions and input schemas', () => {
    const click = toolNamed('click')
    const type = toolNamed('type')
    const hover = toolNamed('hover')
    const scroll = toolNamed('scroll')
    const select = toolNamed('select')
    const press = toolNamed('press')
    const navigate = toolNamed('navigate')
    expect(click?.description).toBe('Click the element identified by uid.')
    expect(type?.description).toBe('Type text into the element identified by uid.')
    expect(hover?.description).toBe('Hover over the element identified by uid.')
    expect(scroll?.description).toBe('Scroll by dx/dy within the element identified by uid.')
    expect(select?.description).toBe('Select a value in the element identified by uid.')
    expect(press?.description).toBe('Press a key on the page.')
    expect(navigate?.description).toBe('Navigate the page to a URL.')
    expect(click?.inputSchema.safeParse({ uid: '1' }).success).toBe(true)
    expect(click?.inputSchema.safeParse({}).success).toBe(false)
    expect(type?.inputSchema.safeParse({ uid: '1', text: 'hi' }).success).toBe(true)
    expect(type?.inputSchema.safeParse({ uid: '1' }).success).toBe(false)
    expect(hover?.inputSchema.safeParse({ uid: '1' }).success).toBe(true)
    expect(hover?.inputSchema.safeParse({}).success).toBe(false)
    expect(scroll?.inputSchema.safeParse({ uid: '1', dx: 1, dy: 2 }).success).toBe(true)
    expect(scroll?.inputSchema.safeParse({ uid: '1', dx: 1 }).success).toBe(false)
    expect(scroll?.inputSchema.safeParse({ uid: '1', dy: 2 }).success).toBe(false)
    expect(select?.inputSchema.safeParse({ uid: '1', value: 'v' }).success).toBe(true)
    expect(select?.inputSchema.safeParse({ uid: '1' }).success).toBe(false)
    expect(press?.inputSchema.safeParse({ key: 'Enter' }).success).toBe(true)
    expect(press?.inputSchema.safeParse({}).success).toBe(false)
    expect(navigate?.inputSchema.safeParse({ url: 'https://example.com' }).success).toBe(true)
    expect(navigate?.inputSchema.safeParse({}).success).toBe(false)
  })

  it('wires the observe tool to the page through the context', async () => {
    const page = recordPage()
    const result = await handlerFor('observe')?.({}, { experimental: false, page })
    expect(result).toEqual({
      snapshot: { uid: 'x', role: 'generic', name: '' },
      image: '',
      overlay: {},
      pageState: { url: '', title: '' },
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
    expect(await handlerFor('type')?.({ uid: '1', text: 'x' }, ctx)).toEqual({ ok: true })
    expect(await handlerFor('hover')?.({ uid: '1' }, ctx)).toEqual({ ok: true })
    expect(await handlerFor('scroll')?.({ uid: '1', dx: 1, dy: 2 }, ctx)).toEqual({ ok: true })
    expect(await handlerFor('select')?.({ uid: '1', value: 'v' }, ctx)).toEqual({ ok: true })
    expect(await handlerFor('press')?.({ key: 'Enter' }, ctx)).toEqual({ ok: true })
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

  it('throws when the page is null', async () => {
    await expect(
      handlerFor('click')?.({ uid: 'x' }, { experimental: false, page: null }),
    ).rejects.toThrow(/requires a page/i)
  })

  it('throws when the page is an object without click', async () => {
    await expect(
      handlerFor('click')?.({ uid: 'x' }, { experimental: false, page: { foo: 1 } }),
    ).rejects.toThrow(/requires a page/i)
  })

  it('throws when the page has a non-function click', async () => {
    await expect(
      handlerFor('click')?.(
        { uid: 'x' },
        { experimental: false, page: { click: 'not-a-function' } },
      ),
    ).rejects.toThrow(/requires a page/i)
  })

  it('throws on invalid args', async () => {
    const page = recordPage()
    const primitives: unknown[] = [null, undefined, 1, 'nope', true, false]
    for (const args of primitives) {
      await expectInvalidArgs('click', args, page)
      await expectInvalidArgs('type', args, page)
      await expectInvalidArgs('hover', args, page)
      await expectInvalidArgs('scroll', args, page)
      await expectInvalidArgs('select', args, page)
      await expectInvalidArgs('press', args, page)
      await expectInvalidArgs('navigate', args, page)
    }
    await expectInvalidArgs('click', {}, page)
    await expectInvalidArgs('click', { text: 'x' }, page)
    await expectInvalidArgs('type', {}, page)
    await expectInvalidArgs('type', { uid: '1' }, page)
    await expectInvalidArgs('type', { text: 'hi' }, page)
    await expectInvalidArgs('hover', {}, page)
    await expectInvalidArgs('scroll', {}, page)
    await expectInvalidArgs('scroll', { uid: '1' }, page)
    await expectInvalidArgs('scroll', { uid: '1', dx: 1 }, page)
    await expectInvalidArgs('scroll', { uid: '1', dy: 2 }, page)
    await expectInvalidArgs('scroll', { dx: 1, dy: 2 }, page)
    await expectInvalidArgs('select', {}, page)
    await expectInvalidArgs('select', { uid: '1' }, page)
    await expectInvalidArgs('select', { value: 'v' }, page)
    await expectInvalidArgs('press', {}, page)
    await expectInvalidArgs('press', { uid: '1' }, page)
    await expectInvalidArgs('navigate', {}, page)
    await expectInvalidArgs('navigate', { uid: '1' }, page)
  })
})
