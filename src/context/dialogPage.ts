import type { PageLike } from './ContextPage.js'

export interface DialogInfo {
  type: string
  message: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isThunk(value: unknown): value is () => unknown {
  return typeof value === 'function'
}

function readStringField(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (isThunk(value)) {
    const result = value()
    if (typeof result === 'string') {
      return result
    }
  }
  return undefined
}

/** Parses a CDP or Puppeteer-shaped dialog payload. Invalid input is null. */
export function dialogFromPayload(payload: unknown): DialogInfo | null {
  if (!isRecord(payload)) {
    return null
  }
  const type = readStringField(payload.type)
  const message = readStringField(payload.message)
  if (type === undefined || message === undefined) {
    return null
  }
  return { type, message }
}

/** Remembers the most recent valid javascript-dialog opening. */
export class DialogTracker {
  private current: DialogInfo | null = null

  last(): DialogInfo | null {
    return this.current
  }

  onOpening(payload: unknown): void {
    const dialog = dialogFromPayload(payload)
    if (dialog !== null) {
      this.current = dialog
    }
  }

  clear(): void {
    this.current = null
  }
}

/** Returns the tracker last-dialog without touching CDP. */
export function getPageDialog(tracker: DialogTracker): DialogInfo | null {
  return tracker.last()
}

/** Accepts or dismisses the open JavaScript dialog. promptText is omitted when undefined. */
export async function acceptDialog(
  page: PageLike,
  accept: boolean,
  promptText?: string,
): Promise<void> {
  if (promptText === undefined) {
    await page.cdp('page', 'Page.handleJavaScriptDialog', { accept })
    return
  }
  await page.cdp('page', 'Page.handleJavaScriptDialog', { accept, promptText })
}
