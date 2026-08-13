/** One tab the MCP last observed in a Chrome process. */
export type BrowserTab = {
  readonly id: string
  readonly url: string
  readonly title: string
  readonly active: boolean
}

/** Lifecycle of a registered MCP Chrome. */
export type InstanceStatus = 'running' | 'closed' | 'orphaned' | 'chrome-dead'

/** One BrowserEngine MCP process and the Chrome it last owned. */
export type InstanceRecord = {
  readonly id: string
  readonly mcpPid: number
  readonly chromePid: number | undefined
  readonly headed: boolean
  readonly tabs: readonly BrowserTab[]
  readonly startedAt: number
  readonly heartbeatAt: number
  readonly status: InstanceStatus
}

/** On-disk registry file. */
export type InstanceFile = {
  readonly records: readonly InstanceRecord[]
}

/** True for a non-null object. Used by registry parse and desk tools. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** True when value is a tab snapshot with id, url, title, and active. */
export function isBrowserTab(value: unknown): value is BrowserTab {
  if (!isPlainObject(value)) {
    return false
  }
  if (typeof value.id !== 'string') {
    return false
  }
  if (typeof value.url !== 'string') {
    return false
  }
  if (typeof value.title !== 'string') {
    return false
  }
  return typeof value.active === 'boolean'
}

/** True when value is a known instance status. */
export function isInstanceStatus(value: unknown): value is InstanceStatus {
  return (
    value === 'running' || value === 'closed' || value === 'orphaned' || value === 'chrome-dead'
  )
}

/** True when this MCP row has a live Chrome pid. */
export function chromeIsOpen(record: InstanceRecord | undefined): boolean {
  return record !== undefined && record.status === 'running' && record.chromePid !== undefined
}

/** Parse one registry row. Invalid shapes become undefined, never throw. */
export function readInstanceRecord(value: unknown): InstanceRecord | undefined {
  if (!isPlainObject(value)) {
    return undefined
  }
  if (typeof value.id !== 'string') {
    return undefined
  }
  if (typeof value.mcpPid !== 'number') {
    return undefined
  }
  if (typeof value.headed !== 'boolean') {
    return undefined
  }
  if (typeof value.startedAt !== 'number') {
    return undefined
  }
  if (typeof value.heartbeatAt !== 'number') {
    return undefined
  }
  if (!isInstanceStatus(value.status)) {
    return undefined
  }
  if (!Array.isArray(value.tabs)) {
    return undefined
  }
  const tabs: BrowserTab[] = []
  for (const tab of value.tabs) {
    if (!isBrowserTab(tab)) {
      return undefined
    }
    tabs.push(tab)
  }
  const chromePid = typeof value.chromePid === 'number' ? value.chromePid : undefined
  return {
    id: value.id,
    mcpPid: value.mcpPid,
    chromePid,
    headed: value.headed,
    tabs,
    startedAt: value.startedAt,
    heartbeatAt: value.heartbeatAt,
    status: value.status,
  }
}

/** An empty registry file. */
export function emptyRegistry(): InstanceFile {
  return { records: [] }
}

/** Parse registry JSON. Callers pass valid JSON; junk objects become empty. */
export function parseRegistry(raw: string): InstanceFile {
  const parsed: unknown = JSON.parse(raw)
  const rows = isPlainObject(parsed) ? parsed.records : undefined
  if (!Array.isArray(rows)) {
    return emptyRegistry()
  }
  const records: InstanceRecord[] = []
  for (const row of rows) {
    const record = readInstanceRecord(row)
    if (record !== undefined) {
      records.push(record)
    }
  }
  return { records }
}

/** Serialize a registry file. */
export function serializeRegistry(file: InstanceFile): string {
  return JSON.stringify(file)
}

/** Insert or replace a record by id. */
export function upsertRecord(file: InstanceFile, next: InstanceRecord): InstanceFile {
  const records: InstanceRecord[] = []
  let found = false
  for (const row of file.records) {
    if (row.id === next.id) {
      records.push(next)
      found = true
    } else {
      records.push(row)
    }
  }
  if (!found) {
    records.push(next)
  }
  return { records }
}

/** Mark a record closed. Keep last tabs so peers can see what it used. */
export function closeRecord(file: InstanceFile, id: string, now: number): InstanceFile {
  const records: InstanceRecord[] = []
  for (const row of file.records) {
    if (row.id === id) {
      records.push({
        ...row,
        status: 'closed',
        chromePid: undefined,
        heartbeatAt: now,
      })
    } else {
      records.push(row)
    }
  }
  return { records }
}

/** Live classification from pids. Closed stays closed. */
export function classifyRecord(
  record: InstanceRecord,
  isAlive: (pid: number) => boolean,
): InstanceStatus {
  if (record.status === 'closed') {
    return 'closed'
  }
  if (!isAlive(record.mcpPid)) {
    return 'orphaned'
  }
  if (record.chromePid !== undefined && !isAlive(record.chromePid)) {
    return 'chrome-dead'
  }
  return 'running'
}

/** Rewrite statuses from live pids. */
export function sweepRegistry(
  file: InstanceFile,
  now: number,
  isAlive: (pid: number) => boolean,
): InstanceFile {
  const records: InstanceRecord[] = []
  for (const row of file.records) {
    const status = classifyRecord(row, isAlive)
    if (status === row.status) {
      records.push(row)
    } else {
      records.push({ ...row, status, heartbeatAt: now })
    }
  }
  return { records }
}

/** Split the swept registry into this MCP, other live MCPs, orphans, and closed. */
export function describeDesk(
  file: InstanceFile,
  mcpPid: number,
  now: number,
  isAlive: (pid: number) => boolean,
): {
  mine: InstanceRecord | undefined
  others: InstanceRecord[]
  orphans: InstanceRecord[]
  closed: InstanceRecord[]
} {
  const swept = sweepRegistry(file, now, isAlive)
  let mine: InstanceRecord | undefined
  const others: InstanceRecord[] = []
  const orphans: InstanceRecord[] = []
  const closed: InstanceRecord[] = []
  for (const row of swept.records) {
    if (row.status === 'orphaned') {
      orphans.push(row)
      continue
    }
    if (row.status === 'closed') {
      closed.push(row)
      continue
    }
    if (row.mcpPid === mcpPid) {
      mine = row
    } else {
      others.push(row)
    }
  }
  return { mine, others, orphans, closed }
}
