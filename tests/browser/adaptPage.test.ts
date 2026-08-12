import { describe, expect, it } from 'vitest'
import {
  toPageLike,
  toPageLikeFromUnknown,
  type PuppeteerPageView,
} from '../../src/browser/adaptPage.js'
import type { PageLike } from '../../src/context/ContextPage.js'

interface FakeOptions {
  snapshot?: unknown
  screenshot?: unknown
  evaluateResult?: unknown
  gotoResult?: unknown
  gotoWait?: Promise<void>
  sendResult?: unknown
}

interface RecordingPage {
  readonly view: PuppeteerPageView
  readonly snapshotCount: number
  readonly screenshotArgs: unknown[]
  readonly evaluateCalls: { fn: unknown; arg: unknown }[]
  readonly gotos: string[]
  readonly keys: string[]
  readonly sendCalls: { method: string; params: unknown }[]
  readonly sessionsCreated: number
}

function recordingPage(options: FakeOptions = {}): RecordingPage {
  const screenshotArgs: unknown[] = []
  const evaluateCalls: { fn: unknown; arg: unknown }[] = []
  const gotos: string[] = []
  const keys: string[] = []
  const sendCalls: { method: string; params: unknown }[] = []
  let snapshotCount = 0
  let sessionsCreated = 0

  const view = {
    accessibility: {
      snapshot: async () => {
        snapshotCount += 1
        return options.snapshot ?? { role: 'WebArea' }
      },
    },
    screenshot: async (opts?: unknown) => {
      screenshotArgs.push(opts)
      return options.screenshot ?? 'data:image/png;base64,ok'
    },
    evaluate: async (fn: unknown, arg?: unknown) => {
      evaluateCalls.push({ fn, arg })
      return options.evaluateResult ?? { ok: true }
    },
    goto: async (url: string) => {
      gotos.push(url)
      if (options.gotoWait !== undefined) {
        await options.gotoWait
      }
      return options.gotoResult ?? { status: 200 }
    },
    keyboard: {
      press: async (key: string) => {
        keys.push(key)
      },
    },
    createCDPSession: async () => {
      sessionsCreated += 1
      return {
        send: async (method: string, params?: unknown) => {
          sendCalls.push({ method, params })
          return options.sendResult ?? { result: 1 }
        },
      }
    },
  } satisfies PuppeteerPageView

  return {
    view,
    get snapshotCount() {
      return snapshotCount
    },
    screenshotArgs,
    evaluateCalls,
    gotos,
    keys,
    sendCalls,
    get sessionsCreated() {
      return sessionsCreated
    },
  }
}

describe('toPageLike', () => {
  it('returns a PageLike whose accessibility.snapshot delegates', async () => {
    const fake = recordingPage({ snapshot: { role: 'button', name: 'Go' } })
    const page: PageLike = toPageLike(fake.view)
    const tree = await page.accessibility.snapshot()
    expect(tree).toEqual({ role: 'button', name: 'Go' })
    expect(fake.snapshotCount).toBe(1)
  })

  it('returns a string screenshot unchanged and forwards opts', async () => {
    const fake = recordingPage({ screenshot: 'already-a-string' })
    const page = toPageLike(fake.view)
    const image = await page.screenshot({ fullPage: true })
    expect(image).toBe('already-a-string')
    expect(fake.screenshotArgs).toEqual([{ fullPage: true }])
  })

  it('encodes a Uint8Array screenshot as a png data URL', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const fake = recordingPage({ screenshot: bytes })
    const image = await toPageLike(fake.view).screenshot()
    expect(image).toBe('data:image/png;base64,AQIDBA==')
  })

  it('rejects a screenshot that is not a string or Uint8Array', async () => {
    const numberPage = recordingPage({ screenshot: 42 })
    await expect(toPageLike(numberPage.view).screenshot()).rejects.toThrow(
      /unsupported type|string|Uint8Array/i,
    )
    const objectPage = recordingPage({ screenshot: { png: true } })
    await expect(toPageLike(objectPage.view).screenshot()).rejects.toThrow(
      /unsupported type|string|Uint8Array/i,
    )
  })

  it('delegates evaluate without an arg', async () => {
    const fake = recordingPage({ evaluateResult: 7 })
    const result = await toPageLike(fake.view).evaluate('() => 1')
    expect(result).toBe(7)
    expect(fake.evaluateCalls).toEqual([{ fn: '() => 1', arg: undefined }])
  })

  it('delegates evaluate with an arg', async () => {
    const fake = recordingPage({ evaluateResult: 'ok' })
    const result = await toPageLike(fake.view).evaluate('(x) => x.n', { n: 3 })
    expect(result).toBe('ok')
    expect(fake.evaluateCalls).toEqual([{ fn: '(x) => x.n', arg: { n: 3 } }])
  })

  it('goto waits for page.goto, records the url, and returns void', async () => {
    let release: (() => void) | undefined
    const gotoWait = new Promise<void>((resolve) => {
      release = resolve
    })
    const fake = recordingPage({ gotoResult: { status: 200 }, gotoWait })
    let settled = false
    const pending = toPageLike(fake.view)
      .goto('https://example.com')
      .then((value) => {
        settled = true
        return value
      })
    expect(fake.gotos).toEqual(['https://example.com'])
    expect(settled).toBe(false)
    if (release !== undefined) {
      release()
    }
    await expect(pending).resolves.toBeUndefined()
    expect(settled).toBe(true)
  })

  it('keyboardPress presses the key on the page keyboard', async () => {
    const fake = recordingPage()
    await toPageLike(fake.view).keyboardPress('Enter')
    expect(fake.keys).toEqual(['Enter'])
  })

  it('cdp creates a session and forwards method plus params', async () => {
    const fake = recordingPage({ sendResult: { root: { nodeId: 1 } } })
    const result = await toPageLike(fake.view).cdp('page', 'DOM.getDocument', { depth: 1 })
    expect(result).toEqual({ root: { nodeId: 1 } })
    expect(fake.sessionsCreated).toBe(1)
    expect(fake.sendCalls).toEqual([{ method: 'DOM.getDocument', params: { depth: 1 } }])
  })

  it('toPageLikeFromUnknown accepts a structural page and rejects a non-page', async () => {
    const fake = recordingPage()
    const page = toPageLikeFromUnknown(fake.view)
    expect(await page.screenshot()).toBe('data:image/png;base64,ok')
    expect(() => toPageLikeFromUnknown({})).toThrow(/not a puppeteer page/i)
    expect(() => toPageLikeFromUnknown(null)).toThrow(/not a puppeteer page/i)
  })

  it('cdp without params still sends the method', async () => {
    const fake = recordingPage({ sendResult: { enabled: true } })
    const result = await toPageLike(fake.view).cdp('unused-session', 'Page.enable')
    expect(result).toEqual({ enabled: true })
    expect(fake.sessionsCreated).toBe(1)
    expect(fake.sendCalls).toHaveLength(1)
    expect(fake.sendCalls[0]?.method).toBe('Page.enable')
  })
})
