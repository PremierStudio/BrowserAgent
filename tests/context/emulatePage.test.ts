import { describe, expect, it } from 'vitest'
import { emulatePage } from '../../src/context/emulatePage.js'
import type { PageLike } from '../../src/context/ContextPage.js'

interface CdpCall {
  session: string
  method: string
  params: unknown
}

function recordingPage(): PageLike & { cdpCalls: CdpCall[] } {
  const cdpCalls: CdpCall[] = []
  return {
    cdpCalls,
    accessibility: { snapshot: async () => ({}) },
    cdp: async (session, method, params) => {
      cdpCalls.push({ session, method, params })
      return {}
    },
    screenshot: async () => '',
    evaluate: async () => undefined,
    goto: async () => undefined,
    keyboardPress: async () => undefined,
  }
}

describe('emulatePage', () => {
  it('does nothing when options is not a record', async () => {
    const page = recordingPage()
    await emulatePage(page, null)
    await emulatePage(page, undefined)
    await emulatePage(page, 4)
    await emulatePage(page, 'offline')
    await emulatePage(page, true)
    await emulatePage(page, false)
    expect(page.cdpCalls).toEqual([])
  })

  it('does nothing when the record has none of the known keys', async () => {
    const page = recordingPage()
    await emulatePage(page, {})
    await emulatePage(page, { foo: 1, bar: true })
    expect(page.cdpCalls).toEqual([])
  })

  it('does nothing when known keys have the wrong types', async () => {
    const page = recordingPage()
    await emulatePage(page, {
      cpu: '4',
      offline: 'yes',
      downloadThroughput: '1',
      uploadThroughput: '1',
      latency: '10',
    })
    expect(page.cdpCalls).toEqual([])
  })

  it('sets CPU throttling from cpu and does not emulate the network', async () => {
    const page = recordingPage()
    await emulatePage(page, { cpu: 4 })
    expect(page.cdpCalls).toEqual([
      {
        session: 'page',
        method: 'Emulation.setCPUThrottlingRate',
        params: { rate: 4 },
      },
    ])
  })

  it('applies a cpu rate of 0', async () => {
    const page = recordingPage()
    await emulatePage(page, { cpu: 0 })
    expect(page.cdpCalls).toEqual([
      {
        session: 'page',
        method: 'Emulation.setCPUThrottlingRate',
        params: { rate: 0 },
      },
    ])
  })

  it('emulates network from offline and fills required CDP defaults', async () => {
    const page = recordingPage()
    await emulatePage(page, { offline: true })
    expect(page.cdpCalls).toEqual([
      {
        session: 'page',
        method: 'Network.emulateNetworkConditions',
        params: {
          offline: true,
          downloadThroughput: -1,
          uploadThroughput: -1,
          latency: 0,
        },
      },
    ])
  })

  it('still calls network when offline is false', async () => {
    const page = recordingPage()
    await emulatePage(page, { offline: false })
    expect(page.cdpCalls).toHaveLength(1)
    expect(page.cdpCalls[0]?.method).toBe('Network.emulateNetworkConditions')
    expect(page.cdpCalls[0]?.params).toEqual({
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    })
  })

  it('emulates network from downloadThroughput only', async () => {
    const page = recordingPage()
    await emulatePage(page, { downloadThroughput: 5000 })
    expect(page.cdpCalls).toEqual([
      {
        session: 'page',
        method: 'Network.emulateNetworkConditions',
        params: {
          offline: false,
          downloadThroughput: 5000,
          uploadThroughput: -1,
          latency: 0,
        },
      },
    ])
  })

  it('emulates network from uploadThroughput only', async () => {
    const page = recordingPage()
    await emulatePage(page, { uploadThroughput: 2500 })
    expect(page.cdpCalls[0]?.session).toBe('page')
    expect(page.cdpCalls[0]?.method).toBe('Network.emulateNetworkConditions')
    expect(page.cdpCalls[0]?.params).toEqual({
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: 2500,
      latency: 0,
    })
  })

  it('emulates network from latency only', async () => {
    const page = recordingPage()
    await emulatePage(page, { latency: 80 })
    expect(page.cdpCalls[0]?.params).toEqual({
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 80,
    })
  })

  it('passes through zero network values instead of substituting defaults', async () => {
    const page = recordingPage()
    await emulatePage(page, {
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0,
    })
    expect(page.cdpCalls[0]?.params).toEqual({
      offline: false,
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0,
    })
  })

  it('applies cpu and network together', async () => {
    const page = recordingPage()
    await emulatePage(page, {
      cpu: 2,
      offline: true,
      downloadThroughput: 100,
      uploadThroughput: 50,
      latency: 20,
    })
    expect(page.cdpCalls).toEqual([
      {
        session: 'page',
        method: 'Emulation.setCPUThrottlingRate',
        params: { rate: 2 },
      },
      {
        session: 'page',
        method: 'Network.emulateNetworkConditions',
        params: {
          offline: true,
          downloadThroughput: 100,
          uploadThroughput: 50,
          latency: 20,
        },
      },
    ])
  })

  it('ignores unknown keys while applying known ones', async () => {
    const page = recordingPage()
    await emulatePage(page, { cpu: 3, extra: 'nope' })
    expect(page.cdpCalls).toHaveLength(1)
    expect(page.cdpCalls[0]?.session).toBe('page')
    expect(page.cdpCalls[0]?.method).toBe('Emulation.setCPUThrottlingRate')
    expect(page.cdpCalls[0]?.params).toEqual({ rate: 3 })
  })
})
