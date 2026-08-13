import { isPlainObject } from './instanceRegistry.js'
import type { TabHost, TabPage } from './tabDesk.js'

/** Adapt an unknown Puppeteer Page to the tab host surface. */
export function toRawTabPageFromUnknown(raw: unknown): RawTabPage {
  if (!isPlainObject(raw)) {
    throw new Error('page is not an object')
  }
  const urlFn = raw.url
  const titleFn = raw.title
  const gotoFn = raw.goto
  const closeFn = raw.close
  const frontFn = raw.bringToFront
  if (
    typeof urlFn !== 'function' ||
    typeof titleFn !== 'function' ||
    typeof gotoFn !== 'function' ||
    typeof closeFn !== 'function' ||
    typeof frontFn !== 'function'
  ) {
    throw new Error('page is missing tab methods')
  }
  return {
    url: () => {
      const value: unknown = urlFn.call(raw)
      return typeof value === 'string' ? value : ''
    },
    title: async () => {
      const value: unknown = await titleFn.call(raw)
      return typeof value === 'string' ? value : ''
    },
    goto: async (url) => {
      await gotoFn.call(raw, url)
    },
    close: async () => {
      await closeFn.call(raw)
    },
    bringToFront: async () => {
      await frontFn.call(raw)
    },
  }
}

/** The narrow Puppeteer page surface the tab host needs. */
export type RawTabPage = {
  url: () => string
  title: () => Promise<string>
  goto: (url: string) => Promise<void>
  close: () => Promise<void>
  bringToFront: () => Promise<void>
}

/** Cache wrappers so tab ids stay stable across list calls. */
export function createRawTabCache(): (raw: unknown) => RawTabPage {
  const cache = new Map<unknown, RawTabPage>()
  return (raw) => {
    const existing = cache.get(raw)
    if (existing !== undefined) {
      return existing
    }
    const wrapped = toRawTabPageFromUnknown(raw)
    cache.set(raw, wrapped)
    return wrapped
  }
}

/** Factory for a TabHost over live Chrome pages. */
export type ChromeTabHostOptions = {
  pages: () => Promise<readonly RawTabPage[]>
  newPage: () => Promise<RawTabPage>
  onActivate: (page: RawTabPage) => Promise<void>
}

/** Assigns stable tab ids and talks to Chrome pages through TabHost. */
export function createChromeTabHost(options: ChromeTabHostOptions): TabHost {
  const ids = new WeakMap<RawTabPage, string>()
  let next = 0
  let currentId: string | undefined

  function idOf(page: RawTabPage): string {
    const existing = ids.get(page)
    if (existing !== undefined) {
      return existing
    }
    next += 1
    const id = `tab-${String(next)}`
    ids.set(page, id)
    return id
  }

  async function asTab(page: RawTabPage): Promise<TabPage> {
    return {
      id: idOf(page),
      url: page.url(),
      title: await page.title(),
    }
  }

  async function pageById(id: string): Promise<RawTabPage | undefined> {
    const pages = await options.pages()
    for (const page of pages) {
      if (idOf(page) === id) {
        return page
      }
    }
    return undefined
  }

  return {
    list: async () => {
      const pages = await options.pages()
      const tabs: TabPage[] = []
      for (const page of pages) {
        tabs.push(await asTab(page))
      }
      return tabs
    },
    create: async (url) => {
      const page = await options.newPage()
      if (url !== undefined) {
        await page.goto(url)
      }
      const tab = await asTab(page)
      currentId = tab.id
      await options.onActivate(page)
      return tab
    },
    close: async (id) => {
      const page = await pageById(id)
      if (page !== undefined) {
        await page.close()
      }
    },
    activate: async (id) => {
      const page = await pageById(id)
      if (page !== undefined) {
        await page.bringToFront()
        currentId = id
        await options.onActivate(page)
      }
    },
    currentId: () => currentId,
    setCurrentId: (id) => {
      currentId = id
    },
  }
}
