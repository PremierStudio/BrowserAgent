import { describe, expect, it } from 'vitest'
import { runFlow } from '../../src/intent/runFlow.js'
import type { ContextPage } from '../../src/context/ContextPage.js'

function recordPage(): ContextPage & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    getElementByUid: async () => undefined,
    waitForEventsAfterAction: async () => undefined,
    observe: async () => ({
      snapshot: { uid: 'x', role: 'generic', name: '' },
      image: '',
      overlay: {},
      pageState: { url: '', title: '' },
    }),
    emulate: async () => undefined,
    getDialog: async () => null,
    click: async (uid) => {
      calls.push(`click:${uid}`)
    },
    type: async (uid, text) => {
      calls.push(`type:${uid}:${text}`)
    },
    hover: async (uid) => {
      calls.push(`hover:${uid}`)
    },
    scroll: async (uid, dx, dy) => {
      calls.push(`scroll:${uid}:${dx}:${dy}`)
    },
    select: async (uid, value) => {
      calls.push(`select:${uid}:${value}`)
    },
    press: async (key) => {
      calls.push(`press:${key}`)
    },
    navigate: async (url) => {
      calls.push(`navigate:${url}`)
    },
  }
}

describe('runFlow', () => {
  it('runs a sequence of steps against the page', async () => {
    const page = recordPage()
    const result = await runFlow(page, [
      { action: 'navigate', url: 'https://example.com' },
      { action: 'click', uid: 'btn-1' },
      { action: 'type', uid: 'in-1', text: 'hi' },
      { action: 'hover', uid: 'btn-1' },
      { action: 'scroll', uid: 'box', dx: 0, dy: 10 },
      { action: 'select', uid: 'sel', value: 'a' },
      { action: 'press', key: 'Enter' },
    ])
    expect(result).toEqual({ ok: true, steps: 7 })
    expect(page.calls).toEqual([
      'navigate:https://example.com',
      'click:btn-1',
      'type:in-1:hi',
      'hover:btn-1',
      'scroll:box:0:10',
      'select:sel:a',
      'press:Enter',
    ])
  })

  it('returns zero steps for an empty flow', async () => {
    const page = recordPage()
    expect(await runFlow(page, [])).toEqual({ ok: true, steps: 0 })
    expect(page.calls).toEqual([])
  })

  it('throws on an unknown action', async () => {
    const page = recordPage()
    await expect(runFlow(page, [{ action: 'explode', uid: 'x' }])).rejects.toThrow(
      /unknown action/i,
    )
  })

  it('throws when a uid-based action is missing uid', async () => {
    const page = recordPage()
    await expect(runFlow(page, [{ action: 'click' }])).rejects.toThrow(/requires uid/i)
  })

  it('throws when press is missing key', async () => {
    const page = recordPage()
    await expect(runFlow(page, [{ action: 'press' }])).rejects.toThrow(/requires key/i)
  })

  it('throws when navigate is missing url', async () => {
    const page = recordPage()
    await expect(runFlow(page, [{ action: 'navigate' }])).rejects.toThrow(/requires url/i)
  })

  it('defaults missing type text, select value, and scroll deltas', async () => {
    const page = recordPage()
    await runFlow(page, [
      { action: 'type', uid: 'in-1' },
      { action: 'select', uid: 'sel' },
      { action: 'scroll', uid: 'box' },
    ])
    expect(page.calls).toEqual(['type:in-1:', 'select:sel:', 'scroll:box:0:0'])
  })
})
