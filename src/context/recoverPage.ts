import type { ContextPage, ObserveResult } from './ContextPage.js'

/** True when Puppeteer/CDP lost the page or browser. */
export function isDeadSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  return (
    error.message.includes('Session closed') ||
    error.message.includes('Target closed') ||
    error.message.includes('Connection closed')
  )
}

/** A lazy page that can be forced closed so the next call relaunches. */
export type RecoveringPage = ContextPage & {
  reset: () => void
  adopt: (page: ContextPage) => void
}

/**
 * A ContextPage that opens on demand and reopens once after a dead CDP session.
 */
export function createRecoveringPage(open: () => Promise<ContextPage>): RecoveringPage {
  let opened: ContextPage | undefined
  let pending: Promise<ContextPage> | undefined

  async function ensure(): Promise<ContextPage> {
    if (opened !== undefined) {
      return opened
    }
    if (pending === undefined) {
      pending = open()
    }
    try {
      opened = await pending
      return opened
    } finally {
      pending = undefined
    }
  }

  function reset(): void {
    opened = undefined
    pending = undefined
  }

  function adopt(page: ContextPage): void {
    opened = page
    pending = undefined
  }

  async function run<T>(fn: (page: ContextPage) => Promise<T>): Promise<T> {
    try {
      return await fn(await ensure())
    } catch (error) {
      if (!isDeadSessionError(error)) {
        throw error
      }
      reset()
      return fn(await ensure())
    }
  }

  return {
    reset,
    adopt,
    getElementByUid: async (uid) => run((page) => page.getElementByUid(uid)),
    waitForEventsAfterAction: async () => run((page) => page.waitForEventsAfterAction()),
    observe: async (): Promise<ObserveResult> => run((page) => page.observe()),
    emulate: async (options) => run((page) => page.emulate(options)),
    getDialog: async () => run((page) => page.getDialog()),
    click: async (uid) => run((page) => page.click(uid)),
    type: async (uid, text) => run((page) => page.type(uid, text)),
    hover: async (uid) => run((page) => page.hover(uid)),
    scroll: async (uid, dx, dy) => run((page) => page.scroll(uid, dx, dy)),
    select: async (uid, value) => run((page) => page.select(uid, value)),
    press: async (key) => run((page) => page.press(key)),
    navigate: async (url) => run((page) => page.navigate(url)),
  }
}
