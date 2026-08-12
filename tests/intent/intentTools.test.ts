import { describe, expect, it } from 'vitest'
import { buildIntentTools } from '../../src/intent/intentTools.js'
import type { ContextPage } from '../../src/context/ContextPage.js'
import type { SnapshotNode } from '../../src/snapshot/a11ySnapshot.js'

const tree: SnapshotNode = {
  uid: 'root',
  role: 'document',
  name: 'Home',
  children: [{ uid: 'btn-1', role: 'button', name: 'Submit', value: 'go' }],
}

function recordPage(): ContextPage {
  return {
    getElementByUid: async () => undefined,
    waitForEventsAfterAction: async () => undefined,
    observe: async () => ({ snapshot: tree, image: '', overlay: {} }),
    emulate: async () => undefined,
    getDialog: async () => null,
    click: async () => undefined,
    type: async () => undefined,
    hover: async () => undefined,
    scroll: async () => undefined,
    select: async () => undefined,
    press: async () => undefined,
    navigate: async () => undefined,
  }
}

function handlerFor(name: string) {
  return buildIntentTools().find((tool) => tool.name === name)?.handler
}

describe('buildIntentTools', () => {
  it('returns watch_until, run_flow, verify, and explain in order', () => {
    expect(buildIntentTools().map((tool) => tool.name)).toEqual([
      'watch_until',
      'run_flow',
      'verify',
      'explain',
    ])
  })

  it('watch_until matches a uid on the current page', async () => {
    const result = await handlerFor('watch_until')?.(
      { kind: 'uid', value: 'btn-1', timeout: 1000 },
      { experimental: false, page: recordPage() },
    )
    expect(result).toEqual({ matched: true, reason: 'condition met' })
  })

  it('run_flow executes steps on the page', async () => {
    const result = await handlerFor('run_flow')?.(
      { steps: [{ action: 'click', uid: 'btn-1' }] },
      { experimental: false, page: recordPage() },
    )
    expect(result).toEqual({ ok: true, steps: 1 })
  })

  it('verify asserts against the current snapshot', async () => {
    const result = await handlerFor('verify')?.(
      { kind: 'uidExists', uid: 'btn-1' },
      { experimental: false, page: recordPage() },
    )
    expect(result).toMatchObject({ pass: true })
  })

  it('explain describes a uid on the current snapshot', async () => {
    const result = await handlerFor('explain')?.(
      { kind: 'uid', uid: 'btn-1' },
      { experimental: false, page: recordPage() },
    )
    expect(result).toMatchObject({ annotation: { highlight: 'ring' } })
  })

  it('throws when a page is missing', async () => {
    await expect(
      handlerFor('verify')?.({ kind: 'uidExists', uid: 'x' }, { experimental: false }),
    ).rejects.toThrow(/requires a page/i)
  })

  it('throws when the page is not a ContextPage', async () => {
    await expect(
      handlerFor('verify')?.(
        { kind: 'uidExists', uid: 'x' },
        { experimental: false, page: { notAPage: true } },
      ),
    ).rejects.toThrow(/requires a page/i)
    await expect(
      handlerFor('watch_until')?.(
        { kind: 'uid', value: 'x', timeout: 1 },
        { experimental: false, page: null },
      ),
    ).rejects.toThrow(/requires a page/i)
    await expect(
      handlerFor('run_flow')?.({ steps: [] }, { experimental: false, page: { observe: 'nope' } }),
    ).rejects.toThrow(/requires a page/i)
  })

  it('explain describes a diff target', async () => {
    const result = await handlerFor('explain')?.(
      {
        kind: 'diff',
        diff: { added: [{ uid: 'a' }], removed: [], changed: [] },
      },
      { experimental: false, page: recordPage() },
    )
    expect(result).toMatchObject({ annotation: { highlight: 'diff' } })
  })

  it('explain throws when a diff target has no diff', async () => {
    await expect(
      handlerFor('explain')?.({ kind: 'diff' }, { experimental: false, page: recordPage() }),
    ).rejects.toThrow(/invalid args/i)
  })

  it('throws on invalid args', async () => {
    const page = recordPage()
    await expect(handlerFor('watch_until')?.({}, { experimental: false, page })).rejects.toThrow(
      /invalid args/i,
    )
    await expect(handlerFor('run_flow')?.({}, { experimental: false, page })).rejects.toThrow(
      /invalid args/i,
    )
    await expect(handlerFor('verify')?.({}, { experimental: false, page })).rejects.toThrow(
      /invalid args/i,
    )
    await expect(handlerFor('explain')?.({}, { experimental: false, page })).rejects.toThrow(
      /invalid args/i,
    )
  })
})
