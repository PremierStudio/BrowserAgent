import { describe, expect, it } from 'vitest'
import { closeTab, listTabs, openTab, switchTab, type TabHost } from '../../src/browser/tabDesk.js'
import type { BrowserTab } from '../../src/browser/instanceRegistry.js'

function memoryHost(initial: readonly BrowserTab[]): TabHost {
  const pages: { id: string; url: string; title: string }[] = []
  for (const tab of initial) {
    pages.push({ id: tab.id, url: tab.url, title: tab.title })
  }
  let currentId = initial.find((tab) => tab.active)?.id ?? initial[0]?.id
  let next = initial.length
  return {
    list: async () => pages.map((page) => ({ ...page })),
    create: async (url) => {
      next += 1
      const page = {
        id: `tab-${String(next)}`,
        url: url ?? 'about:blank',
        title: url === undefined ? 'New Tab' : url,
      }
      pages.push(page)
      return page
    },
    close: async (id) => {
      const index = pages.findIndex((page) => page.id === id)
      if (index >= 0) {
        pages.splice(index, 1)
      }
    },
    activate: async (id) => {
      currentId = id
    },
    currentId: () => currentId,
    setCurrentId: (id) => {
      currentId = id
    },
  }
}

describe('tabDesk', () => {
  it('lists tabs and marks the current one active', async () => {
    const host = memoryHost([
      { id: 'a', url: 'https://a.example', title: 'A', active: false },
      { id: 'b', url: 'https://b.example', title: 'B', active: true },
    ])
    expect(await listTabs(host)).toEqual([
      { id: 'a', url: 'https://a.example', title: 'A', active: false },
      { id: 'b', url: 'https://b.example', title: 'B', active: true },
    ])
  })

  it('opens a tab, makes it current, and can switch back', async () => {
    const host = memoryHost([{ id: 'a', url: 'https://a.example', title: 'A', active: true }])
    const opened = await openTab(host, 'https://b.example')
    expect(opened).toEqual([
      { id: 'a', url: 'https://a.example', title: 'A', active: false },
      { id: 'tab-2', url: 'https://b.example', title: 'https://b.example', active: true },
    ])
    expect(await switchTab(host, 'a')).toEqual([
      { id: 'a', url: 'https://a.example', title: 'A', active: true },
      { id: 'tab-2', url: 'https://b.example', title: 'https://b.example', active: false },
    ])
  })

  it('opens a blank tab when no url is given', async () => {
    const host = memoryHost([{ id: 'a', url: 'https://a.example', title: 'A', active: true }])
    const opened = await openTab(host)
    expect(opened[1]).toEqual({
      id: 'tab-2',
      url: 'about:blank',
      title: 'New Tab',
      active: true,
    })
  })

  it('closes a background tab without changing the current one', async () => {
    const host = memoryHost([
      { id: 'a', url: 'https://a.example', title: 'A', active: true },
      { id: 'b', url: 'https://b.example', title: 'B', active: false },
    ])
    const activated: string[] = []
    const activate = host.activate
    host.activate = async (id) => {
      activated.push(id)
      await activate(id)
    }
    expect(await closeTab(host, 'b')).toEqual([
      { id: 'a', url: 'https://a.example', title: 'A', active: true },
    ])
    expect(activated).toEqual([])
  })

  it('closes the current tab and activates the first remaining tab', async () => {
    const host = memoryHost([
      { id: 'a', url: 'https://a.example', title: 'A', active: false },
      { id: 'b', url: 'https://b.example', title: 'B', active: true },
    ])
    expect(await closeTab(host, 'b')).toEqual([
      { id: 'a', url: 'https://a.example', title: 'A', active: true },
    ])
  })

  it('throws if closing the current tab emptied the host', async () => {
    const pages = [
      { id: 'a', url: 'https://a.example', title: 'A' },
      { id: 'b', url: 'https://b.example', title: 'B' },
    ]
    const host: TabHost = {
      list: async () => pages.map((page) => ({ ...page })),
      create: async () => ({ id: 'x', url: 'about:blank', title: 'New Tab' }),
      close: async () => {
        pages.splice(0, pages.length)
      },
      activate: async () => undefined,
      currentId: () => 'b',
      setCurrentId: () => undefined,
    }
    await expect(closeTab(host, 'b')).rejects.toThrow(/last tab/)
  })

  it('refuses to close the last tab or a missing id', async () => {
    const host = memoryHost([{ id: 'a', url: 'https://a.example', title: 'A', active: true }])
    let closed = 0
    const originalClose = host.close
    host.close = async (id) => {
      closed += 1
      await originalClose(id)
    }
    await expect(closeTab(host, 'a')).rejects.toThrow('cannot close the last tab')
    expect(closed).toBe(0)
    await expect(closeTab(host, 'missing')).rejects.toThrow('no tab missing')
    await expect(switchTab(host, 'missing')).rejects.toThrow('no tab missing')
  })
})
