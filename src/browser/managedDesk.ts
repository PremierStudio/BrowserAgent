import type { BrowserController, DeskSnapshot } from './browserDesk.js'
import type { createBrowserDesk } from './browserDesk.js'
import { closeTab, listTabs, openTab, switchTab, type TabHost } from './tabDesk.js'

/** A launched Chrome this MCP owns. */
export type ChromeSession = {
  readonly pid: number | undefined
  close: () => Promise<void>
  readonly host: TabHost
}

/** Options for a desk that launches Chrome and talks to the shared registry. */
export type ManagedDeskOptions = {
  desk: ReturnType<typeof createBrowserDesk>
  headed: boolean
  launch: () => Promise<ChromeSession>
  kill: (pid: number) => void
}

/** Launch, close, reap orphans, and manage tabs against one MCP desk. */
export function createManagedDesk(options: ManagedDeskOptions): BrowserController {
  let session: ChromeSession | undefined

  async function refresh(): Promise<DeskSnapshot> {
    if (session !== undefined) {
      const tabs = await listTabs(session.host)
      options.desk.markOpen(session.pid, options.headed, tabs)
    }
    return options.desk.snapshot()
  }

  async function ensure(): Promise<ChromeSession> {
    if (session !== undefined) {
      return session
    }
    session = await options.launch()
    return session
  }

  return {
    status: async () => refresh(),
    open: async () => {
      await ensure()
      return refresh()
    },
    close: async () => {
      const live = session
      session = undefined
      if (live !== undefined) {
        await live.close().catch(() => undefined)
      }
      options.desk.markClosed()
      return options.desk.snapshot()
    },
    reap: async () => {
      const orphans = options.desk.snapshot().orphans
      for (const row of orphans) {
        if (row.chromePid !== undefined) {
          options.kill(row.chromePid)
        }
        options.desk.markClosedId(row.id)
      }
      return options.desk.snapshot()
    },
    newTab: async (url) => {
      const live = await ensure()
      await openTab(live.host, url)
      return refresh()
    },
    closeTab: async (id) => {
      if (session === undefined) {
        throw new Error('browser is not open')
      }
      await closeTab(session.host, id)
      return refresh()
    },
    switchTab: async (id) => {
      if (session === undefined) {
        throw new Error('browser is not open')
      }
      await switchTab(session.host, id)
      return refresh()
    },
  }
}
