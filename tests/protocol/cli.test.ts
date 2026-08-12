import { describe, expect, it } from 'vitest'
import { McpServer } from '@modelcontextprotocol/server'
import {
  buildCliMain,
  buildHttpHandler,
  createDefaultServer,
  type Serve,
} from '../../src/protocol/cli.js'

describe('buildCliMain', () => {
  it('creates a main that serves via the provided serve function', () => {
    let factory: (() => unknown) | undefined
    let served = false
    const serve: Serve = (f) => {
      factory = f
      served = true
      return { close: async () => undefined }
    }
    const main = buildCliMain(serve)
    main()
    expect(served).toBe(true)
    expect(typeof factory).toBe('function')
  })

  it('the factory returns a server built from the standard tool set', () => {
    let factory: (() => unknown) | undefined
    const serve: Serve = (f) => {
      factory = f
      return { close: async () => undefined }
    }
    const main = buildCliMain(serve)
    main()
    const server = factory?.()
    expect(server).toBeDefined()
  })

  it('the factory server exposes confirm and task tools', () => {
    let factory: (() => { toolInputSchemaJson: (name: string) => unknown }) | undefined
    const serve: Serve = (f) => {
      factory = f
      return { close: async () => undefined }
    }
    buildCliMain(serve)()
    const server = factory?.()
    expect(server?.toolInputSchemaJson('confirm_action')).toBeDefined()
    expect(server?.toolInputSchemaJson('get_task')).toBeDefined()
  })
})

describe('createDefaultServer', () => {
  it('accepts a page and still exposes observe', () => {
    const page = {
      getElementByUid: async () => undefined,
      waitForEventsAfterAction: async () => undefined,
      observe: async () => ({
        snapshot: { uid: 'x', role: 'generic', name: '' },
        image: '',
        overlay: {},
      }),
      emulate: async () => undefined,
      getDialog: async () => null,
      click: async () => undefined,
      type: async () => undefined,
      hover: async () => undefined,
      scroll: async () => undefined,
      select: async () => undefined,
      press: async () => undefined,
      navigate: async () => undefined,
    }
    const server = createDefaultServer({ page })
    expect(server.toolInputSchemaJson('observe')).toBeDefined()
  })

  it('returns an McpServer with the event resource and task tools', () => {
    const server = createDefaultServer()
    expect(server).toBeInstanceOf(McpServer)
    expect(server.toolInputSchemaJson('observe')).toBeDefined()
    expect(server.toolInputSchemaJson('confirm_action')).toBeDefined()
    expect(server.toolInputSchemaJson('wait_task')).toBeDefined()
    expect(server.toolInputSchemaJson('watch_until')).toBeDefined()
    expect(server.toolInputSchemaJson('verify')).toBeDefined()
    expect(server.toolInputSchemaJson('explain')).toBeDefined()
    expect(server.toolInputSchemaJson('run_flow')).toBeDefined()
  })
})

describe('buildHttpHandler', () => {
  it('returns a fetch-shaped handler', () => {
    const handler = buildHttpHandler()
    expect(typeof handler.fetch).toBe('function')
  })

  it('serves an initialize POST through the default server factory', async () => {
    const handler = buildHttpHandler()
    const response = await handler.fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2026-07-28',
            capabilities: {},
            clientInfo: { name: 'test', version: '0.0.1' },
          },
        }),
      }),
    )
    expect(response.status).toBeGreaterThanOrEqual(200)
    expect(response.status).toBeLessThan(600)
  })
})
