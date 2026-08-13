import { describe, expect, it } from 'vitest'
import { createLazyContextPage } from '../../src/context/lazyPage.js'
import type { ContextPage, ObserveResult } from '../../src/context/ContextPage.js'

function blankObserve(): ObserveResult {
  return {
    snapshot: { uid: 'root', role: 'document', name: 'Home' },
    image: '',
    overlay: {},
    pageState: { url: 'https://example.com', title: 'Home' },
  }
}

function recordPage(): ContextPage & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    getElementByUid: async (uid) => {
      calls.push(`get:${uid}`)
      return uid
    },
    waitForEventsAfterAction: async () => {
      calls.push('wait')
    },
    observe: async () => {
      calls.push('observe')
      return blankObserve()
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
}

describe('createLazyContextPage', () => {
  it('does not open a browser until the first page method', async () => {
    let opens = 0
    const inner = recordPage()
    const page = createLazyContextPage(async () => {
      opens += 1
      return inner
    })
    expect(opens).toBe(0)
    await page.observe()
    expect(opens).toBe(1)
    await page.click('x')
    expect(opens).toBe(1)
    expect(inner.calls).toEqual(['observe', 'click:x'])
  })

  it('retries open after a failed first attempt', async () => {
    let opens = 0
    const inner = recordPage()
    const page = createLazyContextPage(async () => {
      opens += 1
      if (opens === 1) {
        throw new Error('launch failed')
      }
      return inner
    })
    await expect(page.observe()).rejects.toThrow(/launch failed/)
    await page.observe()
    expect(opens).toBe(2)
    expect(inner.calls).toEqual(['observe'])
  })

  it('opens once when two methods run together', async () => {
    let opens = 0
    const inner = recordPage()
    const page = createLazyContextPage(async () => {
      opens += 1
      return inner
    })
    await Promise.all([page.click('a'), page.type('b', 'x')])
    expect(opens).toBe(1)
    expect(inner.calls).toEqual(['click:a', 'type:b:x'])
  })

  it('delegates every ContextPage method after open', async () => {
    const inner = recordPage()
    const page = createLazyContextPage(async () => inner)
    expect(await page.getElementByUid('u1')).toBe('u1')
    await page.waitForEventsAfterAction()
    expect(await page.observe()).toEqual(blankObserve())
    await page.emulate('mobile')
    expect(await page.getDialog()).toBeNull()
    await page.click('c')
    await page.type('t', 'hi')
    await page.hover('h')
    await page.scroll('s', 1, 2)
    await page.select('e', 'v')
    await page.press('Enter')
    await page.navigate('https://example.com')
    expect(inner.calls).toEqual([
      'get:u1',
      'wait',
      'observe',
      'emulate:mobile',
      'dialog',
      'click:c',
      'type:t:hi',
      'hover:h',
      'scroll:s:1:2',
      'select:e:v',
      'press:Enter',
      'navigate:https://example.com',
    ])
  })
})
