import { describe, expect, it } from 'vitest'
import {
  INSTALL_RESIZE_LISTENER,
  createResizeBridge,
  installResizeListener,
} from '../../src/browser/resizeBridge.js'
import type { EventSource } from '../../src/events/EventCollector.js'
import type { WindowLayout } from '../../src/browser/windowLayout.js'

const snap: WindowLayout = {
  x: 0,
  y: 40,
  width: 1280,
  height: 1366,
  viewportWidth: 1278,
  viewportHeight: 1300,
}

function listen(source: EventSource, event: string): unknown[] {
  const received: unknown[] = []
  source.on(event, (payload) => {
    received.push(payload)
  })
  return received
}

describe('createResizeBridge', () => {
  it('delivers a valid window layout on resized', () => {
    const bridge = createResizeBridge()
    const received = listen(bridge.source, 'resized')
    bridge.ingest(snap)
    expect(received).toEqual([snap])
  })

  it('drops invalid payloads and other event names', () => {
    const bridge = createResizeBridge()
    const resized = listen(bridge.source, 'resized')
    const other = listen(bridge.source, 'dommutated')
    bridge.ingest(null)
    bridge.ingest({ width: 10 })
    expect(resized).toEqual([])
    expect(other).toEqual([])
  })

  it('does not throw when ingesting before any listener is registered', () => {
    const bridge = createResizeBridge()
    expect(() => {
      bridge.ingest(snap)
    }).not.toThrow()
  })

  it('notifies every resized handler', () => {
    const bridge = createResizeBridge()
    const a = listen(bridge.source, 'resized')
    const b = listen(bridge.source, 'resized')
    bridge.ingest(snap)
    expect(a).toEqual([snap])
    expect(b).toEqual([snap])
  })
})

describe('INSTALL_RESIZE_LISTENER', () => {
  it('installs a window resize hook that posts outer and inner sizes', () => {
    expect(INSTALL_RESIZE_LISTENER).toContain('__baResizeInstalled')
    expect(INSTALL_RESIZE_LISTENER).toContain('addEventListener("resize"')
    expect(INSTALL_RESIZE_LISTENER).toContain('screenX')
    expect(INSTALL_RESIZE_LISTENER).toContain('outerWidth')
    expect(INSTALL_RESIZE_LISTENER).toContain('innerWidth')
    expect(INSTALL_RESIZE_LISTENER).toContain('__baResize')
  })
})

describe('installResizeListener', () => {
  it('exposes __baResize then evaluates the installer', async () => {
    const calls: string[] = []
    await installResizeListener(
      async (script) => {
        calls.push(`eval:${script}`)
        return undefined
      },
      async (name, _fn) => {
        calls.push(`expose:${name}`)
      },
      () => undefined,
    )
    expect(calls[0]).toBe('expose:__baResize')
    expect(calls[1]?.startsWith('eval:')).toBe(true)
    expect(calls[1]).toContain('__baResizeInstalled')
  })
})
