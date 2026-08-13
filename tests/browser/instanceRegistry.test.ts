import { describe, expect, it } from 'vitest'
import {
  chromeIsOpen,
  classifyRecord,
  closeRecord,
  describeDesk,
  emptyRegistry,
  isBrowserTab,
  isInstanceStatus,
  isPlainObject,
  parseRegistry,
  readInstanceRecord,
  serializeRegistry,
  sweepRegistry,
  upsertRecord,
  type InstanceRecord,
} from '../../src/browser/instanceRegistry.js'

function record(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    id: 'a1',
    mcpPid: 10,
    chromePid: 20,
    headed: true,
    tabs: [{ id: 't1', url: 'https://example.com', title: 'Example', active: true }],
    startedAt: 1000,
    heartbeatAt: 2000,
    status: 'running',
    ...overrides,
  }
}

describe('parseRegistry', () => {
  it('returns an empty file for missing or junk input', () => {
    expect(parseRegistry('[]')).toEqual(emptyRegistry())
    expect(parseRegistry('{"records":1}')).toEqual(emptyRegistry())
    expect(parseRegistry('null')).toEqual(emptyRegistry())
    expect(parseRegistry('{"foo":true}')).toEqual(emptyRegistry())
  })

  it('round-trips a valid record list', () => {
    const file = { records: [record()] }
    expect(parseRegistry(serializeRegistry(file))).toEqual(file)
  })

  it('drops invalid rows and keeps a well-formed one', () => {
    const raw = JSON.stringify({
      records: [
        { nope: true },
        { id: 1, mcpPid: 1 },
        { id: 'x', mcpPid: 1, headed: 'yes' },
        {
          id: 'x',
          mcpPid: 1,
          headed: true,
          startedAt: 'n',
          heartbeatAt: 1,
          status: 'running',
          tabs: [],
        },
        {
          id: 'x',
          mcpPid: 1,
          headed: true,
          startedAt: 1,
          heartbeatAt: 'n',
          status: 'running',
          tabs: [],
        },
        {
          id: 'x',
          mcpPid: 1,
          headed: true,
          startedAt: 1,
          heartbeatAt: 1,
          status: 'nope',
          tabs: [],
        },
        {
          id: 'x',
          mcpPid: 1,
          headed: true,
          startedAt: 1,
          heartbeatAt: 1,
          status: 'running',
          tabs: 'nope',
        },
        {
          id: 'ok',
          mcpPid: 1,
          headed: true,
          startedAt: 1,
          heartbeatAt: 1,
          status: 'running',
          tabs: [{ url: 1 }],
        },
        {
          id: 'old-tab',
          mcpPid: 1,
          headed: true,
          startedAt: 1,
          heartbeatAt: 1,
          status: 'running',
          tabs: [{ url: 'https://old.example', title: 'Old' }],
        },
        {
          id: 'kept',
          mcpPid: 1,
          headed: true,
          startedAt: 1,
          heartbeatAt: 1,
          status: 'running',
          tabs: [],
          chromePid: 'x',
        },
        record({ id: 'dead', status: 'chrome-dead' }),
        1,
      ],
    })
    const parsed = parseRegistry(raw)
    expect(parsed.records.map((row) => row.id)).toEqual(['kept', 'dead'])
    expect(parsed.records[0]?.chromePid).toBeUndefined()
  })

  it('drops a row that fails any single required field', () => {
    const valid = {
      id: 'ok',
      mcpPid: 1,
      headed: true,
      startedAt: 1,
      heartbeatAt: 1,
      status: 'running',
      tabs: [],
    }
    const rows = [
      { ...valid, id: 1 },
      { ...valid, mcpPid: 'x' },
      { ...valid, headed: 'yes' },
      { ...valid, startedAt: 'n' },
      { ...valid, heartbeatAt: 'n' },
      { ...valid, status: 'nope' },
      { ...valid, tabs: 'nope' },
      { ...valid, tabs: [{ id: 1, url: 'u', title: 't', active: true }] },
      { ...valid, tabs: [{ id: 't', url: 1, title: 't', active: true }] },
      { ...valid, tabs: [{ id: 't', url: 'u', title: 1, active: true }] },
      { ...valid, tabs: [{ id: 't', url: 'u', title: 't', active: 'yes' }] },
    ]
    expect(parseRegistry(JSON.stringify({ records: rows })).records).toEqual([])
  })
})

describe('isBrowserTab, isInstanceStatus, chromeIsOpen', () => {
  it('accepts only a complete tab and known statuses', () => {
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(1)).toBe(false)
    expect(isPlainObject('x')).toBe(false)
    expect(isPlainObject({})).toBe(true)
    expect(readInstanceRecord(null)).toBeUndefined()
    expect(readInstanceRecord(1)).toBeUndefined()
    expect(
      readInstanceRecord({
        id: 'ok',
        mcpPid: 1,
        headed: true,
        startedAt: 1,
        heartbeatAt: 1,
        status: 'running',
        tabs: { 0: { id: 't', url: 'u', title: 't', active: true }, length: 1 },
      }),
    ).toBeUndefined()
    expect(isBrowserTab(null)).toBe(false)
    expect(isBrowserTab({ id: 1, url: 'u', title: 't', active: true })).toBe(false)
    expect(isBrowserTab({ id: 't', url: 1, title: 't', active: true })).toBe(false)
    expect(isBrowserTab({ id: 't', url: 'u', title: 1, active: true })).toBe(false)
    expect(isBrowserTab({ id: 't', url: 'u', title: 't', active: 'yes' })).toBe(false)
    expect(isBrowserTab({ id: 't', url: 'u', title: 't' })).toBe(false)
    expect(isBrowserTab({ id: 't', url: 'u', title: 't', active: true })).toBe(true)
    expect(isInstanceStatus('running')).toBe(true)
    expect(isInstanceStatus('closed')).toBe(true)
    expect(isInstanceStatus('orphaned')).toBe(true)
    expect(isInstanceStatus('chrome-dead')).toBe(true)
    expect(isInstanceStatus('nope')).toBe(false)
    expect(chromeIsOpen(undefined)).toBe(false)
    expect(chromeIsOpen(record({ chromePid: undefined }))).toBe(false)
    expect(chromeIsOpen(record({ status: 'chrome-dead' }))).toBe(false)
    expect(chromeIsOpen(record())).toBe(true)
  })
})

describe('upsertRecord and closeRecord', () => {
  it('inserts and replaces by id', () => {
    const first = upsertRecord(emptyRegistry(), record())
    const second = upsertRecord(first, record({ tabs: [], heartbeatAt: 3000 }))
    expect(second.records).toHaveLength(1)
    expect(second.records[0]?.heartbeatAt).toBe(3000)
    expect(second.records[0]?.tabs).toEqual([])
    const two = upsertRecord(first, record({ id: 'b' }))
    const replaced = upsertRecord(two, record({ id: 'a1', heartbeatAt: 9 }))
    expect(replaced.records.map((row) => row.id)).toEqual(['a1', 'b'])
    expect(replaced.records[0]?.heartbeatAt).toBe(9)
  })

  it('marks a record closed without dropping it or its last tabs', () => {
    const closed = closeRecord(upsertRecord(emptyRegistry(), record()), 'a1', 5000)
    expect(closed.records[0]?.status).toBe('closed')
    expect(closed.records[0]?.heartbeatAt).toBe(5000)
    expect(closed.records[0]?.tabs).toEqual([
      { id: 't1', url: 'https://example.com', title: 'Example', active: true },
    ])
    expect(closed.records[0]?.chromePid).toBeUndefined()
    const untouched = closeRecord(upsertRecord(emptyRegistry(), record()), 'missing', 9)
    expect(untouched.records[0]?.status).toBe('running')
  })
})

describe('classifyRecord', () => {
  const alive = (pid: number) => pid === 10 || pid === 20

  it('keeps a live running record', () => {
    expect(classifyRecord(record(), alive)).toBe('running')
  })

  it('leaves an explicit close as closed', () => {
    expect(classifyRecord(record({ status: 'closed' }), alive)).toBe('closed')
  })

  it('orphans a record whose MCP pid is dead', () => {
    expect(classifyRecord(record(), (pid) => pid === 20)).toBe('orphaned')
  })

  it('marks chrome-dead when the browser pid is gone but MCP is alive', () => {
    expect(classifyRecord(record(), (pid) => pid === 10)).toBe('chrome-dead')
  })
})

describe('sweepRegistry and describeDesk', () => {
  it('rewrites dead MCP rows to orphaned and splits the desk view', () => {
    const file = {
      records: [
        record({ id: 'mine', mcpPid: 10, chromePid: 20 }),
        record({ id: 'peer', mcpPid: 11, chromePid: 21 }),
        record({ id: 'ghost', mcpPid: 12, chromePid: 22 }),
        record({ id: 'done', mcpPid: 13, status: 'closed', chromePid: undefined }),
      ],
    }
    const alive = (pid: number) => pid === 10 || pid === 20 || pid === 11 || pid === 21
    const liveOnly = sweepRegistry(
      { records: [record({ id: 'stable', heartbeatAt: 2000 })] },
      9999,
      () => true,
    )
    expect(liveOnly.records[0]?.heartbeatAt).toBe(2000)
    const swept = sweepRegistry(file, 3000, alive)
    expect(swept.records.find((row) => row.id === 'ghost')?.status).toBe('orphaned')
    expect(swept.records.find((row) => row.id === 'done')?.status).toBe('closed')
    const desk = describeDesk(swept, 10, 3000, alive)
    expect(desk.mine?.id).toBe('mine')
    expect(desk.others.map((row) => row.id)).toEqual(['peer'])
    expect(desk.orphans.map((row) => row.id)).toEqual(['ghost'])
    expect(desk.closed.map((row) => row.id)).toEqual(['done'])
    expect(desk.closed[0]?.tabs).toEqual([
      { id: 't1', url: 'https://example.com', title: 'Example', active: true },
    ])
  })
})
