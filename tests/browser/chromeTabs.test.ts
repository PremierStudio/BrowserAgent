import { describe, expect, it } from 'vitest'
import {
  createChromeTabHost,
  createRawTabCache,
  toRawTabPageFromUnknown,
  type RawTabPage,
} from '../../src/browser/chromeTabs.js'
import { closeTab, listTabs, openTab, switchTab } from '../../src/browser/tabDesk.js'

function rawPage(url: string, title: string): RawTabPage & { closed: boolean; front: number } {
  const self: RawTabPage & { closed: boolean; front: number } = {
    closed: false,
    front: 0,
    url: () => url,
    title: async () => title,
    goto: async (next) => {
      url = next
      title = next
    },
    close: async () => {
      self.closed = true
    },
    bringToFront: async () => {
      self.front += 1
    },
  }
  return self
}

describe('createChromeTabHost', () => {
  it('assigns stable ids and drives open, switch, and close', async () => {
    const first = rawPage('https://home.example', 'Home')
    const pages: RawTabPage[] = [first]
    const activated: string[] = []
    const host = createChromeTabHost({
      pages: async () => pages.filter((page) => !('closed' in page) || page.closed === false),
      newPage: async () => {
        const created = rawPage('about:blank', 'New Tab')
        pages.push(created)
        return created
      },
      onActivate: async (page) => {
        activated.push(page.url())
      },
    })
    host.setCurrentId((await listTabs(host))[0]?.id ?? '')
    const listed = await listTabs(host)
    expect(listed).toEqual([
      { id: 'tab-1', url: 'https://home.example', title: 'Home', active: true },
    ])
    const opened = await openTab(host, 'https://shop.example')
    expect(opened.map((tab) => tab.url)).toEqual(['https://home.example', 'https://shop.example'])
    expect(opened[1]?.active).toBe(true)
    expect(activated).toEqual(['https://shop.example'])
    await switchTab(host, 'tab-1')
    expect(first.front).toBe(1)
    expect(activated).toEqual(['https://shop.example', 'https://home.example'])
    const second = pages[1]
    await closeTab(host, 'tab-2')
    expect(second !== undefined && 'closed' in second && second.closed).toBe(true)
    expect(await listTabs(host)).toEqual([
      { id: 'tab-1', url: 'https://home.example', title: 'Home', active: true },
    ])
  })

  it('wraps an unknown page and rejects a missing one', async () => {
    const raw = rawPage('https://home.example', 'Home')
    const wrapped = toRawTabPageFromUnknown(raw)
    expect(wrapped.url()).toBe('https://home.example')
    expect(await wrapped.title()).toBe('Home')
    await wrapped.goto('https://next.example')
    expect(wrapped.url()).toBe('https://next.example')
    await wrapped.bringToFront()
    await wrapped.close()
    expect(raw.closed).toBe(true)
    expect(raw.front).toBe(1)
    expect(() => toRawTabPageFromUnknown(null)).toThrow(/not an object/)
    expect(() => toRawTabPageFromUnknown({})).toThrow(/missing tab methods/)
    const base = {
      url: () => 'https://home.example',
      title: async () => 'Home',
      goto: async () => undefined,
      close: async () => undefined,
      bringToFront: async () => undefined,
    }
    expect(() => toRawTabPageFromUnknown({ ...base, url: 1 })).toThrow(/missing tab methods/)
    expect(() => toRawTabPageFromUnknown({ ...base, title: 1 })).toThrow(/missing tab methods/)
    expect(() => toRawTabPageFromUnknown({ ...base, goto: 1 })).toThrow(/missing tab methods/)
    expect(() => toRawTabPageFromUnknown({ ...base, close: 1 })).toThrow(/missing tab methods/)
    expect(() => toRawTabPageFromUnknown({ ...base, bringToFront: 1 })).toThrow(
      /missing tab methods/,
    )
    const odd = {
      url: () => 1,
      title: async () => 1,
      goto: async () => undefined,
      close: async () => undefined,
      bringToFront: async () => undefined,
    }
    const coerced = toRawTabPageFromUnknown(odd)
    expect(coerced.url()).toBe('')
    expect(await coerced.title()).toBe('')
  })

  it('opens a blank tab when url is omitted', async () => {
    const pages: RawTabPage[] = [rawPage('https://home.example', 'Home')]
    const host = createChromeTabHost({
      pages: async () => pages,
      newPage: async () => {
        const created = rawPage('about:blank', 'New Tab')
        pages.push(created)
        return created
      },
      onActivate: async () => undefined,
    })
    host.setCurrentId('tab-1')
    const opened = await openTab(host)
    expect(opened[1]).toMatchObject({ url: 'about:blank', title: 'New Tab', active: true })
  })

  it('reuses a wrapped page and ignores close or switch of a missing id', async () => {
    const wrap = createRawTabCache()
    const raw = rawPage('https://home.example', 'Home')
    expect(wrap(raw)).toBe(wrap(raw))
    const host = createChromeTabHost({
      pages: async () => [wrap(raw)],
      newPage: async () => wrap(raw),
      onActivate: async () => undefined,
    })
    await host.close('missing')
    await host.activate('missing')
    expect(raw.closed).toBe(false)
    expect(raw.front).toBe(0)
  })
})
