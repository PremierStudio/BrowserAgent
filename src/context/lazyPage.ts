import type { ContextPage, ObserveResult } from './ContextPage.js'

/**
 * A ContextPage that does not exist until the first method runs.
 * MCP can start without opening Chrome; the first tool call opens it.
 */
export function createLazyContextPage(open: () => Promise<ContextPage>): ContextPage {
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

  return {
    getElementByUid: async (uid) => (await ensure()).getElementByUid(uid),
    waitForEventsAfterAction: async () => (await ensure()).waitForEventsAfterAction(),
    observe: async (): Promise<ObserveResult> => (await ensure()).observe(),
    emulate: async (options) => (await ensure()).emulate(options),
    getDialog: async () => (await ensure()).getDialog(),
    click: async (uid) => (await ensure()).click(uid),
    type: async (uid, text) => (await ensure()).type(uid, text),
    hover: async (uid) => (await ensure()).hover(uid),
    scroll: async (uid, dx, dy) => (await ensure()).scroll(uid, dx, dy),
    select: async (uid, value) => (await ensure()).select(uid, value),
    press: async (key) => (await ensure()).press(key),
    navigate: async (url) => (await ensure()).navigate(url),
  }
}
