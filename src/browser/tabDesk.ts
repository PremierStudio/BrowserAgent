import type { BrowserTab } from './instanceRegistry.js'

/** One Chrome page the tab desk can address by id. */
export type TabPage = {
  readonly id: string
  readonly url: string
  readonly title: string
}

/** Injected Chrome pages for list/open/close/switch. */
export type TabHost = {
  list: () => Promise<readonly TabPage[]>
  create: (url: string | undefined) => Promise<TabPage>
  close: (id: string) => Promise<void>
  activate: (id: string) => Promise<void>
  currentId: () => string | undefined
  setCurrentId: (id: string) => void
}

/** Snapshot of host pages with the current tab marked active. */
export async function listTabs(host: TabHost): Promise<BrowserTab[]> {
  const pages = await host.list()
  const current = host.currentId()
  const tabs: BrowserTab[] = []
  for (const page of pages) {
    tabs.push({
      id: page.id,
      url: page.url,
      title: page.title,
      active: page.id === current,
    })
  }
  return tabs
}

/** Open a tab (blank when url is omitted) and make it current. */
export async function openTab(host: TabHost, url?: string): Promise<BrowserTab[]> {
  const page = await host.create(url)
  host.setCurrentId(page.id)
  return listTabs(host)
}

async function requireTab(host: TabHost, id: string): Promise<readonly TabPage[]> {
  const pages = await host.list()
  for (const page of pages) {
    if (page.id === id) {
      return pages
    }
  }
  throw new Error(`no tab ${id}`)
}

/** Close a tab. Refuses the last tab. Activates another if the current one closed. */
export async function closeTab(host: TabHost, id: string): Promise<BrowserTab[]> {
  const pages = await requireTab(host, id)
  if (pages.length === 1) {
    throw new Error('cannot close the last tab')
  }
  await host.close(id)
  if (host.currentId() === id) {
    const remaining = await host.list()
    const next = remaining[0]
    if (next === undefined) {
      throw new Error('cannot close the last tab')
    }
    host.setCurrentId(next.id)
    await host.activate(next.id)
  }
  return listTabs(host)
}

/** Bring a tab to the front and mark it current. */
export async function switchTab(host: TabHost, id: string): Promise<BrowserTab[]> {
  await requireTab(host, id)
  host.setCurrentId(id)
  await host.activate(id)
  return listTabs(host)
}
