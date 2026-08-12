import type { PageLike } from '../context/ContextPage.js'

/**
 * Structural view of a Puppeteer Page. This is not an import from puppeteer;
 * a real Page satisfies it, and tests supply an in-memory fake.
 * screenshot is `Promise<unknown>` so the adapter can reject unexpected
 * runtime values (Puppeteer yields `Uint8Array | string`).
 */
export interface PuppeteerPageView {
  accessibility: {
    snapshot: () => Promise<unknown>
  }
  screenshot: (opts?: unknown) => Promise<unknown>
  evaluate: (pageFunction: unknown, arg?: unknown) => Promise<unknown>
  goto: (url: string) => Promise<unknown>
  keyboard: {
    press: (key: string) => Promise<void>
  }
  createCDPSession: () => Promise<{
    send: (method: string, params?: unknown) => Promise<unknown>
  }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array
}

function encodePngDataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
}

/**
 * Adapts a Puppeteer page (or a structural fake) to the PageLike contract
 * used by ContextPage and tools.
 */
function hasFn(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'function'
}

function isKeyboard(value: unknown): value is { press: (key: string) => Promise<void> } {
  return isRecord(value) && typeof value.press === 'function'
}

function isAccessibility(value: unknown): value is { snapshot: () => Promise<unknown> } {
  return isRecord(value) && typeof value.snapshot === 'function'
}

/** Returns true when value has the Puppeteer methods we adapt. */
function isPuppeteerPageView(value: unknown): value is PuppeteerPageView {
  if (!isRecord(value)) {
    return false
  }
  return (
    isAccessibility(value.accessibility) &&
    hasFn(value, 'screenshot') &&
    hasFn(value, 'evaluate') &&
    hasFn(value, 'goto') &&
    isKeyboard(value.keyboard) &&
    hasFn(value, 'createCDPSession')
  )
}

/**
 * Adapts an unknown page (typically a real Puppeteer Page) after a structural
 * check, so the CLI can pass a live Page without type assertions.
 */
export function toPageLikeFromUnknown(page: unknown): PageLike {
  if (!isPuppeteerPageView(page)) {
    throw new Error('not a puppeteer page')
  }
  return toPageLike(page)
}

export function toPageLike(page: PuppeteerPageView): PageLike {
  return {
    accessibility: {
      snapshot: () => page.accessibility.snapshot(),
    },
    screenshot: async (opts?: unknown) => {
      const result = await page.screenshot(opts)
      if (isString(result)) {
        return result
      }
      if (isUint8Array(result)) {
        return encodePngDataUrl(result)
      }
      throw new Error('screenshot() returned an unsupported type; expected a string or Uint8Array')
    },
    evaluate: (fn: string, arg?: unknown) => page.evaluate(fn, arg),
    goto: async (url: string) => {
      await page.goto(url)
    },
    keyboardPress: (key: string) => page.keyboard.press(key),
    cdp: async (_session: string, method: string, params?: unknown) => {
      const session = await page.createCDPSession()
      return session.send(method, params)
    },
  }
}
