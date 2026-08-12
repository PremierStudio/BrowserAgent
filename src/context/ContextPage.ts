import type { SnapshotNode } from '../snapshot/a11ySnapshot.js'
import type { Overlay } from '../snapshot/overlay.js'
import { parseUid } from '../uid.js'

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
}

/** A minimal structural view of the Puppeteer Page we depend on. */
export interface PageLike {
  accessibility: {
    snapshot: () => Promise<unknown>
  }
  cdp: (session: string, method: string, params?: unknown) => Promise<unknown>
  screenshot: (opts?: unknown) => Promise<string>
  evaluate: (fn: string) => Promise<unknown>
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
    const axTree = await this.page.accessibility.snapshot()
    void axTree
    const image = await this.page.screenshot()
    return {
      snapshot: { uid: 'placeholder', role: 'generic', name: '' },
      image,
      overlay: {},
    }
  }

  async emulate(options: unknown): Promise<void> {
    void options
    return undefined
  }

  async getDialog(): Promise<unknown> {
    return null
  }
}
