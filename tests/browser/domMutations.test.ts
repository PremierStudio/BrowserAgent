import { describe, expect, it } from 'vitest'
import {
  createDomMutationBridge,
  INSTALL_MUTATION_OBSERVER,
  parseMutationRecord,
} from '../../src/browser/domMutations.js'
import type { EventSource } from '../../src/events/EventCollector.js'

function listen(source: EventSource, event: string): unknown[] {
  const received: unknown[] = []
  source.on(event, (payload) => {
    received.push(payload)
  })
  return received
}

describe('parseMutationRecord', () => {
  it('returns kind and target when both are valid', () => {
    expect(parseMutationRecord({ kind: 'added', target: 'DIV' })).toEqual({
      kind: 'added',
      target: 'DIV',
    })
    expect(parseMutationRecord({ kind: 'removed', target: 'P' })).toEqual({
      kind: 'removed',
      target: 'P',
    })
    expect(parseMutationRecord({ kind: 'changed', target: 'INPUT' })).toEqual({
      kind: 'changed',
      target: 'INPUT',
    })
  })

  it('accepts an empty-string target because it is still a string', () => {
    expect(parseMutationRecord({ kind: 'added', target: '' })).toEqual({
      kind: 'added',
      target: '',
    })
  })

  it('strips extra fields from a valid record', () => {
    expect(parseMutationRecord({ kind: 'added', target: 'SPAN', extra: 1 })).toEqual({
      kind: 'added',
      target: 'SPAN',
    })
  })

  it('returns null unless kind is added, removed, or changed and target is a string', () => {
    const cases: unknown[] = [
      null,
      undefined,
      1,
      'added',
      true,
      [],
      {},
      { kind: 'added' },
      { target: 'DIV' },
      { kind: 'moved', target: 'DIV' },
      { kind: 'ADDED', target: 'DIV' },
      { kind: 'added', target: 1 },
      { kind: 1, target: 'DIV' },
      { kind: 'added', target: null },
      { kind: null, target: 'DIV' },
    ]
    for (const value of cases) {
      expect(parseMutationRecord(value)).toBeNull()
    }
  })
})

describe('createDomMutationBridge', () => {
  it('delivers a valid ingest payload to dommutated handlers', () => {
    const bridge = createDomMutationBridge()
    const received = listen(bridge.source, 'dommutated')
    bridge.ingest({ kind: 'added', target: 'div#main' })
    expect(received).toEqual([{ kind: 'added', target: 'div#main' }])
  })

  it('delivers removed and changed kinds', () => {
    const bridge = createDomMutationBridge()
    const received = listen(bridge.source, 'dommutated')
    bridge.ingest({ kind: 'removed', target: 'p' })
    bridge.ingest({ kind: 'changed', target: 'input' })
    expect(received).toEqual([
      { kind: 'removed', target: 'p' },
      { kind: 'changed', target: 'input' },
    ])
  })

  it('drops invalid payloads and does not default a missing kind', () => {
    const bridge = createDomMutationBridge()
    const received = listen(bridge.source, 'dommutated')
    bridge.ingest(null)
    bridge.ingest(undefined)
    bridge.ingest('added')
    bridge.ingest({ target: 'div' })
    bridge.ingest({ kind: 'added' })
    bridge.ingest({ kind: 'moved', target: 'div' })
    bridge.ingest({ kind: 'added', target: 1 })
    expect(received).toEqual([])
  })

  it('does not notify listeners registered for other event names', () => {
    const bridge = createDomMutationBridge()
    const other = listen(bridge.source, 'console')
    const received = listen(bridge.source, 'dommutated')
    bridge.ingest({ kind: 'added', target: 'div' })
    expect(other).toEqual([])
    expect(received).toEqual([{ kind: 'added', target: 'div' }])
  })

  it('notifies every dommutated handler', () => {
    const bridge = createDomMutationBridge()
    const first = listen(bridge.source, 'dommutated')
    const second = listen(bridge.source, 'dommutated')
    bridge.ingest({ kind: 'changed', target: 'body' })
    expect(first).toEqual([{ kind: 'changed', target: 'body' }])
    expect(second).toEqual([{ kind: 'changed', target: 'body' }])
  })

  it('does not throw when ingesting before any listener is registered', () => {
    const bridge = createDomMutationBridge()
    expect(() => bridge.ingest({ kind: 'added', target: 'div' })).not.toThrow()
  })
})

describe('INSTALL_MUTATION_OBSERVER', () => {
  it('is a page script that installs a MutationObserver and reports mutations', () => {
    expect(INSTALL_MUTATION_OBSERVER).toContain('MutationObserver')
    expect(INSTALL_MUTATION_OBSERVER).toMatch(/dommutated|added/)
    expect(INSTALL_MUTATION_OBSERVER).toContain('observe')
  })
})
