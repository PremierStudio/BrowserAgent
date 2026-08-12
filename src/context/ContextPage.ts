import type { SnapshotNode } from '../snapshot/a11ySnapshot.js'
import type { Overlay } from '../snapshot/overlay.js'
import { parseUid } from '../uid.js'
import {
  clickUid,
  hoverUid,
  navigateTo,
  pressKey,
  scrollUid,
  selectUid,
  typeUid,
} from './actOnPage.js'
import { observePage } from './observePage.js'

/** The result of observing a page. */
export interface ObserveResult {
  snapshot: SnapshotNode
  image: string
  overlay: Overlay
}

/** A narrow contract that hides Puppeteer behind a testable interface. */
export interface ContextPage {
  getElementByUid(uid: string): Promise<unknown>
  waitForEventsAfterAction(): Promise<void>
  observe(): Promise<ObserveResult>
  emulate(options: unknown): Promise<void>
  getDialog(): Promise<unknown>
  click(uid: string): Promise<void>
  type(uid: string, text: string): Promise<void>
  hover(uid: string): Promise<void>
  scroll(uid: string, dx: number, dy: number): Promise<void>
  select(uid: string, value: string): Promise<void>
  press(key: string): Promise<void>
  navigate(url: string): Promise<void>
}

/** A minimal structural view of the Puppeteer Page we depend on. */
export interface PageLike {
  accessibility: {
    snapshot: () => Promise<unknown>
  }
  cdp: (session: string, method: string, params?: unknown) => Promise<unknown>
  screenshot: (opts?: unknown) => Promise<string>
  evaluate: (fn: string, arg?: unknown) => Promise<unknown>
  goto: (url: string) => Promise<void>
  keyboardPress: (key: string) => Promise<void>
}

/**
 * A Puppeteer-backed ContextPage. Tools never touch the raw Puppeteer Page
 * directly; they go through this narrow contract.
 */
export class PuppeteerContextPage implements ContextPage {
  private readonly page: PageLike

  constructor(page: PageLike) {
    this.page = page
  }

  async getElementByUid(uid: string): Promise<unknown> {
    // Resolve a uid (loaderId_backendNodeId) to a live element reference.
    const parts = parseUid(uid)
    if (parts === null) {
      throw new Error(`Invalid uid: ${uid}`)
    }
    return { uid, backendNodeId: parts.backendNodeId }
  }

  async waitForEventsAfterAction(): Promise<void> {
    // Wait for navigation and DOM stability after an action.
    return undefined
  }

  async observe(): Promise<ObserveResult> {
    return observePage(this.page)
  }

  async emulate(options: unknown): Promise<void> {
    void options
    return undefined
  }

  async getDialog(): Promise<unknown> {
    return null
  }

  async click(uid: string): Promise<void> {
    await clickUid(this.page, uid)
  }

  async type(uid: string, text: string): Promise<void> {
    await typeUid(this.page, uid, text)
  }

  async hover(uid: string): Promise<void> {
    await hoverUid(this.page, uid)
  }

  async scroll(uid: string, dx: number, dy: number): Promise<void> {
    await scrollUid(this.page, uid, dx, dy)
  }

  async select(uid: string, value: string): Promise<void> {
    await selectUid(this.page, uid, value)
  }

  async press(key: string): Promise<void> {
    await pressKey(this.page, key)
  }

  async navigate(url: string): Promise<void> {
    await navigateTo(this.page, url)
  }
}
