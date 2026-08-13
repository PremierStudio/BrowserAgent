import { describe, expect, it } from 'vitest'
import { createBrowserDesk } from '../../src/browser/browserDesk.js'
import { emptyRegistry, serializeRegistry } from '../../src/browser/instanceRegistry.js'

function memoryStore(initial = serializeRegistry(emptyRegistry())) {
  let text = initial
  return {
    read: () => text,
    write: (next: string) => {
      text = next
    },
  }
}

describe('createBrowserDesk', () => {
  it('reports this MCP as closed until marked open', () => {
    const desk = createBrowserDesk({
      id: 'mine',
      mcpPid: 10,
      clock: () => 1000,
      isAlive: (pid) => pid === 10,
      store: memoryStore(),
    })
    const snap = desk.snapshot()
    expect(snap.open).toBe(false)
    expect(snap.mine).toBeUndefined()
    expect(snap.others).toEqual([])
    expect(snap.orphans).toEqual([])
    expect(snap.closed).toEqual([])
  })

  it('heartbeats this MCP and sees a live peer and an orphan', () => {
    let now = 1000
    const store = memoryStore()
    const peer = createBrowserDesk({
      id: 'peer',
      mcpPid: 11,
      clock: () => now,
      isAlive: () => true,
      store,
    })
    peer.markOpen(21, true, [
      { id: 'peer-tab', url: 'https://peer.example', title: 'Peer', active: true },
    ])
    const ghost = createBrowserDesk({
      id: 'ghost',
      mcpPid: 12,
      clock: () => 1000,
      isAlive: () => true,
      store,
    })
    ghost.markOpen(22, true, [
      { id: 'ghost-tab', url: 'https://ghost.example', title: 'Ghost', active: true },
    ])
    const mine = createBrowserDesk({
      id: 'mine',
      mcpPid: 10,
      clock: () => now,
      isAlive: (pid) => pid === 10 || pid === 11 || pid === 20 || pid === 21,
      store,
    })
    now = 2000
    mine.markOpen(20, true, [
      { id: 'mine-tab', url: 'https://mine.example', title: 'Mine', active: true },
    ])
    const snap = mine.snapshot()
    expect(snap.open).toBe(true)
    now = 3000
    mine.markOpen(20, true, [
      { id: 'mine-tab', url: 'https://mine.example', title: 'Later', active: true },
    ])
    expect(mine.snapshot().mine?.startedAt).toBe(2000)
    expect(mine.snapshot().mine?.heartbeatAt).toBe(3000)
    expect(snap.mine?.chromePid).toBe(20)
    expect(snap.mine?.tabs).toEqual([
      { id: 'mine-tab', url: 'https://mine.example', title: 'Mine', active: true },
    ])
    expect(snap.others.map((row) => row.id)).toEqual(['peer'])
    expect(snap.orphans.map((row) => row.id)).toEqual(['ghost'])
  })

  it('closes this MCP chrome without deleting the row', () => {
    const desk = createBrowserDesk({
      id: 'mine',
      mcpPid: 10,
      clock: () => 1000,
      isAlive: (pid) => pid === 10,
      store: memoryStore(),
    })
    desk.markOpen(20, true, [
      { id: 't1', url: 'https://example.com', title: 'Example', active: true },
    ])
    desk.markClosed()
    const snap = desk.snapshot()
    expect(snap.open).toBe(false)
    expect(snap.mine).toBeUndefined()
    expect(snap.closed.map((row) => row.id)).toEqual(['mine'])
    expect(snap.closed[0]?.tabs).toEqual([
      { id: 't1', url: 'https://example.com', title: 'Example', active: true },
    ])
  })

  it('treats a seen MCP with no Chrome pid as not open', () => {
    const desk = createBrowserDesk({
      id: 'mine',
      mcpPid: 10,
      clock: () => 1000,
      isAlive: (pid) => pid === 10,
      store: memoryStore(),
    })
    desk.markOpen(undefined, true, [])
    const snap = desk.snapshot()
    expect(snap.open).toBe(false)
    expect(snap.mine?.status).toBe('running')
    expect(snap.mine?.chromePid).toBeUndefined()
  })

  it('closes a leftover orphan by id after the agent is gone', () => {
    const store = memoryStore()
    const ghost = createBrowserDesk({
      id: 'ghost',
      mcpPid: 12,
      clock: () => 1000,
      isAlive: () => true,
      store,
    })
    ghost.markOpen(22, true, [
      { id: 'ghost-tab', url: 'https://ghost.example', title: 'Ghost', active: true },
    ])
    const mine = createBrowserDesk({
      id: 'mine',
      mcpPid: 10,
      clock: () => 2000,
      isAlive: (pid) => pid === 10,
      store,
    })
    mine.markClosedId('ghost')
    const snap = mine.snapshot()
    expect(snap.orphans).toEqual([])
    expect(snap.closed.map((row) => row.id)).toEqual(['ghost'])
    expect(snap.closed[0]?.tabs).toEqual([
      { id: 'ghost-tab', url: 'https://ghost.example', title: 'Ghost', active: true },
    ])
  })
})
