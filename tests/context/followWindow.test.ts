import { describe, expect, it } from 'vitest'
import { followWindowIfResized } from '../../src/context/followWindow.js'
import { WindowLayoutTracker, type WindowLayout } from '../../src/browser/windowLayout.js'
import type { PageLike } from '../../src/context/ContextPage.js'

const snap: WindowLayout = {
  x: 0,
  y: 40,
  width: 1280,
  height: 1366,
  viewportWidth: 1278,
  viewportHeight: 1300,
}

function fakePage(): PageLike & { methods: string[]; sessions: string[] } {
  const methods: string[] = []
  const sessions: string[] = []
  return {
    methods,
    sessions,
    accessibility: { snapshot: async () => ({}) },
    cdp: async (session, method) => {
      sessions.push(session)
      methods.push(method)
      return {}
    },
    screenshot: async () => '',
    evaluate: async () => undefined,
    goto: async () => undefined,
    keyboardPress: async () => undefined,
  }
}

describe('followWindowIfResized', () => {
  it('does nothing without a layout or on the first sample', async () => {
    const page = fakePage()
    const tracker = new WindowLayoutTracker()
    expect(await followWindowIfResized(page, tracker, undefined)).toBe(false)
    expect(await followWindowIfResized(page, tracker, snap)).toBe(false)
    expect(page.methods).toEqual([])
  })

  it('clears a locked viewport when the user resizes or moves the window', async () => {
    const page = fakePage()
    const tracker = new WindowLayoutTracker()
    await followWindowIfResized(page, tracker, snap)
    expect(await followWindowIfResized(page, tracker, { ...snap, width: 1600, x: 200 })).toBe(true)
    expect(page.sessions).toEqual(['page'])
    expect(page.methods).toEqual(['Emulation.clearDeviceMetricsOverride'])
  })

  it('does not clear again when the window stays put', async () => {
    const page = fakePage()
    const tracker = new WindowLayoutTracker()
    await followWindowIfResized(page, tracker, snap)
    await followWindowIfResized(page, tracker, { ...snap, width: 1600 })
    page.methods.length = 0
    expect(await followWindowIfResized(page, tracker, { ...snap, width: 1600 })).toBe(false)
    expect(page.methods).toEqual([])
  })
})
