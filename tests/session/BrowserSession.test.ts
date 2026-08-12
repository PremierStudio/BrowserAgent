import { describe, expect, it } from 'vitest'
import { BrowserSession, sessionWaitAfterAction } from '../../src/session/BrowserSession.js'
import { ActionLog } from '../../src/actions/ActionLog.js'
import { DiffTracker } from '../../src/diff/DiffTracker.js'
import { EventBuffer } from '../../src/events/EventBuffer.js'
import type { ContextPage } from '../../src/context/ContextPage.js'
import type { SnapshotNode } from '../../src/snapshot/a11ySnapshot.js'

function pageWith(snapshot: SnapshotNode, calls: string[] = []): ContextPage {
  return {
    getElementByUid: async (uid) => {
      calls.push(`get:${uid}`)
      return uid
    },
    waitForEventsAfterAction: async () => {
      calls.push('wait')
    },
    observe: async () => ({
      snapshot,
      image: 'img',
      overlay: {},
      pageState: { url: '', title: '' },
    }),
    emulate: async () => {
      calls.push('emulate')
    },
    getDialog: async () => {
      calls.push('dialog')
      return null
    },
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

const first: SnapshotNode = { uid: 'root', role: 'document', name: 'A' }
const second: SnapshotNode = {
  uid: 'root',
  role: 'document',
  name: 'B',
  children: [{ uid: 'btn', role: 'button', name: 'Go' }],
}

describe('sessionWaitAfterAction', () => {
  it('waits on the page and reports the DOM as stable', async () => {
    const calls: string[] = []
    const page = pageWith(first, calls)
    await expect(sessionWaitAfterAction(page)).resolves.toBe(true)
    expect(calls).toEqual(['wait'])
  })
})

describe('BrowserSession', () => {
  it('returns the first observe with an empty diff and buffered events', async () => {
    const events = new EventBuffer(10)
    events.push({ type: 'console', timestamp: 1, level: 'log', text: 'hi' })
    const session = new BrowserSession(pageWith(first), {
      tracker: new DiffTracker('session'),
      events,
    })
    const result = await session.observe()
    expect(result.snapshot).toEqual(first)
    expect(result.image).toBe('img')
    expect(result.diff).toEqual({ added: [], removed: [], changed: [] })
    expect(result.events).toEqual([{ type: 'console', timestamp: 1, level: 'log', text: 'hi' }])
  })

  it('returns a diff on the second observe', async () => {
    let n = 0
    const page = pageWith(first)
    const session = new BrowserSession(
      {
        ...page,
        observe: async () => {
          n += 1
          return {
            snapshot: n === 1 ? first : second,
            image: '',
            overlay: {},
            pageState: { url: '', title: '' },
          }
        },
      },
      { tracker: new DiffTracker('session'), events: new EventBuffer(10) },
    )
    await session.observe()
    const result = await session.observe()
    expect(result.diff.changed.length + result.diff.added.length).toBeGreaterThan(0)
  })

  it('records actions through the action log', async () => {
    const log = new ActionLog(10)
    const calls: string[] = []
    const session = new BrowserSession(pageWith(first, calls), {
      log,
      clock: () => 42,
    })
    await session.click('btn')
    await session.type('in', 'x')
    await session.hover('btn')
    await session.scroll('box', 1, 2)
    await session.select('sel', 'a')
    await session.press('Enter')
    await session.navigate('https://example.com')
    expect(calls).toEqual([
      'click:btn',
      'wait',
      'type:in:x',
      'wait',
      'hover:btn',
      'wait',
      'scroll:box:1:2',
      'wait',
      'select:sel:a',
      'wait',
      'press:Enter',
      'wait',
      'navigate:https://example.com',
      'wait',
    ])
    expect(log.all().map((e) => e.action)).toEqual([
      'click',
      'type',
      'hover',
      'scroll',
      'select',
      'press',
      'navigate',
    ])
    expect(log.all()[0]?.timestamp).toBe(42)
    expect(calls).toContain('wait')
  })

  it('delegates read helpers to the page', async () => {
    const calls: string[] = []
    const session = new BrowserSession(pageWith(first, calls))
    await session.getElementByUid('btn')
    await session.waitForEventsAfterAction()
    await session.emulate({})
    await session.getDialog()
    const observed = await session.observe()
    expect(calls).toEqual(['get:btn', 'wait', 'emulate', 'dialog'])
    expect(observed.diff).toEqual({ added: [], removed: [], changed: [] })
    expect(observed.events).toEqual([])
  })

  it('exposes the action log for the replay resource', () => {
    const log = new ActionLog(10)
    const session = new BrowserSession(pageWith(first), { log })
    expect(session.actionLog).toBe(log)
  })

  it('uses a default clock when recording actions', async () => {
    const session = new BrowserSession(pageWith(first))
    await session.click('btn')
    expect(session.actionLog.all()).toHaveLength(1)
    expect(session.actionLog.all()[0]?.action).toBe('click')
    expect(session.actionLog.all()[0]?.timestamp).toBe(0)
  })
})
