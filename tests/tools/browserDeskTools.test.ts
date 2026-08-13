import { describe, expect, it } from 'vitest'
import { buildBrowserDeskTools } from '../../src/tools/browserDeskTools.js'
import type { BrowserController } from '../../src/browser/browserDesk.js'

function handlerFor(name: string, controller: BrowserController) {
  return buildBrowserDeskTools(controller).find((tool) => tool.name === name)?.handler
}

function emptySnap(open = false) {
  return { open, mine: undefined, others: [], orphans: [], closed: [] }
}

function fakeController(): BrowserController & {
  opens: number
  closes: number
  reaps: number
  tabs: string[]
} {
  let open = false
  const self: BrowserController & {
    opens: number
    closes: number
    reaps: number
    tabs: string[]
  } = {
    opens: 0,
    closes: 0,
    reaps: 0,
    tabs: [],
    status: async () => ({
      open,
      mine: open
        ? {
            id: 'mine',
            mcpPid: 10,
            chromePid: 20,
            headed: true,
            tabs: [{ id: 't1', url: 'https://example.com', title: 'Home', active: true }],
            startedAt: 1,
            heartbeatAt: 2,
            status: 'running' as const,
          }
        : undefined,
      others: [],
      orphans: [],
      closed: [],
    }),
    open: async () => {
      self.opens += 1
      open = true
      return self.status()
    },
    close: async () => {
      self.closes += 1
      open = false
      return self.status()
    },
    reap: async () => {
      self.reaps += 1
      return self.status()
    },
    newTab: async (url) => {
      self.tabs.push(url ?? 'about:blank')
      open = true
      return self.status()
    },
    closeTab: async (id) => {
      self.tabs.push(`close:${id}`)
      return self.status()
    },
    switchTab: async (id) => {
      self.tabs.push(`switch:${id}`)
      return self.status()
    },
  }
  return self
}

describe('buildBrowserDeskTools', () => {
  it('lists status, open, and close in order', () => {
    const tools = buildBrowserDeskTools({
      status: async () => emptySnap(),
      open: async () => emptySnap(true),
      close: async () => emptySnap(),
      reap: async () => emptySnap(),
      newTab: async () => emptySnap(true),
      closeTab: async () => emptySnap(true),
      switchTab: async () => emptySnap(true),
    })
    expect(tools.map((tool) => tool.name)).toEqual([
      'browser_status',
      'browser_open',
      'browser_close',
      'browser_reap',
      'browser_new_tab',
      'browser_close_tab',
      'browser_switch_tab',
    ])
    expect(tools[0]?.readOnly).toBe(true)
    expect(tools[0]?.description).toMatch(/orphan/i)
    expect(tools[0]?.description).toMatch(/closed instances/i)
    expect(tools[1]?.readOnly).toBe(false)
    expect(tools[1]?.description).toMatch(/already open/i)
    expect(tools[2]?.readOnly).toBe(false)
    expect(tools[2]?.description).toMatch(/registry/i)
    expect(tools[3]?.description).toMatch(/leftover Chrome/i)
    expect(tools[4]?.description).toMatch(/Opens Chrome first/i)
    expect(tools[5]?.description).toMatch(/last tab/i)
    expect(tools[6]?.description).toMatch(/Switch this MCP Chrome/i)
    expect(tools[4]?.inputSchema.safeParse({}).success).toBe(true)
    expect(tools[4]?.inputSchema.safeParse({ url: 'https://shop.example' }).success).toBe(true)
    expect(tools[4]?.inputSchema.safeParse({ url: 1 }).success).toBe(false)
    expect(tools[5]?.inputSchema.safeParse({}).success).toBe(false)
    expect(tools[5]?.inputSchema.safeParse({ id: 't1' }).success).toBe(true)
    expect(tools[6]?.inputSchema.safeParse({ id: 't1' }).success).toBe(true)
    expect(tools[6]?.inputSchema.safeParse({}).success).toBe(false)
  })

  it('reports status and opens then closes the browser', async () => {
    const controller = fakeController()
    const ctx = { experimental: false }
    expect(await handlerFor('browser_status', controller)?.({}, ctx)).toMatchObject({
      open: false,
    })
    expect(await handlerFor('browser_open', controller)?.({}, ctx)).toMatchObject({ open: true })
    expect(controller.opens).toBe(1)
    expect(await handlerFor('browser_status', controller)?.({}, ctx)).toMatchObject({
      open: true,
      mine: { chromePid: 20 },
    })
    expect(await handlerFor('browser_close', controller)?.({}, ctx)).toMatchObject({ open: false })
    expect(controller.closes).toBe(1)
  })

  it('reaps orphans and manages tabs through the controller', async () => {
    const controller = fakeController()
    const ctx = { experimental: false }
    expect(await handlerFor('browser_reap', controller)?.({}, ctx)).toMatchObject({ open: false })
    expect(controller.reaps).toBe(1)
    expect(await handlerFor('browser_new_tab', controller)?.({ url: 'https://shop.example' }, ctx))
    expect(controller.tabs).toEqual(['https://shop.example'])
    expect(await handlerFor('browser_new_tab', controller)?.({}, ctx))
    expect(controller.tabs).toEqual(['https://shop.example', 'about:blank'])
    expect(await handlerFor('browser_switch_tab', controller)?.({ id: 't1' }, ctx))
    expect(await handlerFor('browser_close_tab', controller)?.({ id: 't1' }, ctx))
    expect(controller.tabs).toEqual([
      'https://shop.example',
      'about:blank',
      'switch:t1',
      'close:t1',
    ])
    await expect(handlerFor('browser_close_tab', controller)?.({}, ctx)).rejects.toThrow(
      /id is required/,
    )
    await expect(handlerFor('browser_switch_tab', controller)?.({ id: '' }, ctx)).rejects.toThrow(
      /id is required/,
    )
    await expect(handlerFor('browser_new_tab', controller)?.({ url: 1 }, ctx))
    expect(controller.tabs.at(-1)).toBe('about:blank')
    await expect(handlerFor('browser_new_tab', controller)?.(null, ctx)).resolves.toBeDefined()
    expect(controller.tabs.at(-1)).toBe('about:blank')
  })
})
