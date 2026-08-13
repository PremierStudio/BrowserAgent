import { describe, expect, it } from 'vitest'
import { createRecoveringPage, isDeadSessionError } from '../../src/context/recoverPage.js'
import type { ContextPage, ObserveResult } from '../../src/context/ContextPage.js'

function blank(): ObserveResult {
  return {
    snapshot: { uid: 'root', role: 'document', name: 'Home' },
    image: '',
    overlay: {},
    pageState: { url: 'https://example.com', title: 'Home' },
  }
}

function pageWithObserve(observe: () => Promise<ObserveResult>): ContextPage {
  return {
    getElementByUid: async () => undefined,
    waitForEventsAfterAction: async () => undefined,
    observe,
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

describe('isDeadSessionError', () => {
  it('detects closed CDP and target errors', () => {
    expect(
      isDeadSessionError(new Error('Session closed. Most likely the page has been closed.')),
    ).toBe(true)
    expect(isDeadSessionError(new Error('Protocol error: Target closed'))).toBe(true)
    expect(isDeadSessionError(new Error('Connection closed'))).toBe(true)
    expect(isDeadSessionError(new Error('no target for click'))).toBe(false)
    expect(isDeadSessionError('Session closed')).toBe(false)
  })
})

describe('createRecoveringPage', () => {
  it('retries launch after open itself throws', async () => {
    let opens = 0
    const page = createRecoveringPage(async () => {
      opens += 1
      if (opens === 1) {
        throw new Error('launch failed')
      }
      return pageWithObserve(async () => blank())
    })
    await expect(page.observe()).rejects.toThrow(/launch failed/)
    await page.observe()
    expect(opens).toBe(2)
  })

  it('reopens once after a dead session and then works', async () => {
    let opens = 0
    const page = createRecoveringPage(async () => {
      opens += 1
      if (opens === 1) {
        return pageWithObserve(async () => {
          throw new Error('Session closed. Most likely the page has been closed.')
        })
      }
      return pageWithObserve(async () => blank())
    })
    expect(await page.observe()).toEqual(blank())
    expect(opens).toBe(2)
  })

  it('opens once when two methods run together', async () => {
    let opens = 0
    const page = createRecoveringPage(async () => {
      opens += 1
      return pageWithObserve(async () => blank())
    })
    await Promise.all([page.observe(), page.observe()])
    expect(opens).toBe(1)
    await page.observe()
    expect(opens).toBe(1)
  })

  it('delegates every ContextPage method', async () => {
    const calls: string[] = []
    const inner: ContextPage = {
      getElementByUid: async (uid) => {
        calls.push(`get:${uid}`)
        return uid
      },
      waitForEventsAfterAction: async () => {
        calls.push('wait')
      },
      observe: async () => {
        calls.push('observe')
        return blank()
      },
      emulate: async (options) => {
        calls.push(`emulate:${String(options)}`)
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
    const page = createRecoveringPage(async () => inner)
    expect(await page.getElementByUid('u')).toBe('u')
    await page.waitForEventsAfterAction()
    await page.observe()
    await page.emulate('m')
    expect(await page.getDialog()).toBeNull()
    await page.click('c')
    await page.type('t', 'x')
    await page.hover('h')
    await page.scroll('s', 1, 2)
    await page.select('e', 'v')
    await page.press('Enter')
    await page.navigate('https://example.com')
    expect(calls).toEqual([
      'get:u',
      'wait',
      'observe',
      'emulate:m',
      'dialog',
      'click:c',
      'type:t:x',
      'hover:h',
      'scroll:s:1:2',
      'select:e:v',
      'press:Enter',
      'navigate:https://example.com',
    ])
  })

  it('adopt replaces the opened page without launching again', async () => {
    let opens = 0
    const first = pageWithObserve(async () => blank())
    const second: ContextPage = {
      ...pageWithObserve(async () => ({
        ...blank(),
        pageState: { url: 'https://other.example', title: 'Other' },
      })),
      click: async (uid) => {
        await Promise.resolve(uid)
      },
    }
    const page = createRecoveringPage(async () => {
      opens += 1
      return first
    })
    await page.observe()
    page.adopt(second)
    expect((await page.observe()).pageState.url).toBe('https://other.example')
    await page.click('x')
    expect(opens).toBe(1)
  })

  it('reset forgets the opened page so the next call launches again', async () => {
    let opens = 0
    const page = createRecoveringPage(async () => {
      opens += 1
      return pageWithObserve(async () => blank())
    })
    await page.observe()
    page.reset()
    await page.observe()
    expect(opens).toBe(2)
  })

  it('does not retry a normal error', async () => {
    let opens = 0
    const page = createRecoveringPage(async () => {
      opens += 1
      return pageWithObserve(async () => {
        throw new Error('no target for click name=Nope')
      })
    })
    await expect(page.observe()).rejects.toThrow(/no target/)
    expect(opens).toBe(1)
  })
})
