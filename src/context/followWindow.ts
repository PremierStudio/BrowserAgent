import { WindowLayoutTracker, type WindowLayout } from '../browser/windowLayout.js'
import type { PageLike } from './ContextPage.js'

/**
 * When the headed window moved or grew since the last sample, drop any
 * locked viewport so layout follows the user's size. Never move the window
 * back to the launch snap.
 */
export async function followWindowIfResized(
  page: PageLike,
  tracker: WindowLayoutTracker,
  layout: WindowLayout | undefined,
): Promise<boolean> {
  if (layout === undefined) {
    return false
  }
  const { resized } = tracker.sync(layout)
  if (!resized) {
    return false
  }
  await page.cdp('page', 'Emulation.clearDeviceMetricsOverride')
  return true
}
