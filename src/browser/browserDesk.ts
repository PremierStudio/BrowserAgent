import {
  chromeIsOpen,
  closeRecord,
  describeDesk,
  parseRegistry,
  serializeRegistry,
  upsertRecord,
  type BrowserTab,
  type InstanceRecord,
} from './instanceRegistry.js'

/** Injected registry file. */
type FileStore = {
  read: () => string
  write: (text: string) => void
}

/** Snapshot of this MCP, peers, leftover Chromes, and recently closed ones. */
export type DeskSnapshot = {
  open: boolean
  mine: InstanceRecord | undefined
  others: InstanceRecord[]
  orphans: InstanceRecord[]
  closed: InstanceRecord[]
}

/** Open/close/status/tabs handle used by browser desk tools. */
export type BrowserController = {
  status: () => Promise<DeskSnapshot>
  open: () => Promise<DeskSnapshot>
  close: () => Promise<DeskSnapshot>
  reap: () => Promise<DeskSnapshot>
  newTab: (url?: string) => Promise<DeskSnapshot>
  closeTab: (id: string) => Promise<DeskSnapshot>
  switchTab: (id: string) => Promise<DeskSnapshot>
}

/** Options for a process-local desk bound to one MCP pid. */
export type BrowserDeskOptions = {
  id: string
  mcpPid: number
  clock: () => number
  isAlive: (pid: number) => boolean
  store: FileStore
}

/** Read/write the shared instance registry for this MCP. */
export function createBrowserDesk(options: BrowserDeskOptions): {
  snapshot: () => DeskSnapshot
  markOpen: (chromePid: number | undefined, headed: boolean, tabs: readonly BrowserTab[]) => void
  markClosed: () => void
  markClosedId: (id: string) => void
} {
  function load() {
    return parseRegistry(options.store.read())
  }

  function save(file: ReturnType<typeof parseRegistry>): ReturnType<typeof parseRegistry> {
    options.store.write(serializeRegistry(file))
    return file
  }

  return {
    snapshot: () => {
      const view = describeDesk(load(), options.mcpPid, options.clock(), options.isAlive)
      return {
        open: chromeIsOpen(view.mine),
        mine: view.mine,
        others: view.others,
        orphans: view.orphans,
        closed: view.closed,
      }
    },
    markOpen: (chromePid, headed, tabs) => {
      const now = options.clock()
      const current = load().records.find((row) => row.id === options.id)
      const startedAt = current === undefined ? now : current.startedAt
      save(
        upsertRecord(load(), {
          id: options.id,
          mcpPid: options.mcpPid,
          chromePid,
          headed,
          tabs: [...tabs],
          startedAt,
          heartbeatAt: now,
          status: 'running',
        }),
      )
    },
    markClosed: () => {
      save(closeRecord(load(), options.id, options.clock()))
    },
    markClosedId: (id) => {
      save(closeRecord(load(), id, options.clock()))
    },
  }
}
