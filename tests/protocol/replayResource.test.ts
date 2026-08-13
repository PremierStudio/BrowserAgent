import { describe, expect, it } from 'vitest'
import { McpServer, InMemoryTransport } from '@modelcontextprotocol/server'
import { ActionLog } from '../../src/actions/ActionLog.js'
import {
  createReplayResource,
  REPLAY_RESOURCE_CONFIG,
  toReplayContents,
} from '../../src/protocol/replayResource.js'

describe('REPLAY_RESOURCE_CONFIG', () => {
  it('uses the MCP Apps HTML profile mime type', () => {
    expect(REPLAY_RESOURCE_CONFIG.mimeType).toBe('text/html;profile=mcp-app')
  })
})

describe('toReplayContents', () => {
  it('returns a ui:// HTML document for the action log', () => {
    const log = new ActionLog(10)
    log.record({ action: 'click', uid: 'btn-1', timestamp: 1 })
    const contents = toReplayContents(log, 'ui://browser-engine/replay')
    expect(contents).toHaveLength(1)
    expect(contents[0]?.uri).toBe('ui://browser-engine/replay')
    expect(contents[0]?.mimeType).toBe('text/html;profile=mcp-app')
    expect(contents[0]?.text).toContain('data-action="click"')
  })

  it('defaults to the ui://browser-engine/replay uri', () => {
    const log = new ActionLog(10)
    const contents = toReplayContents(log)
    expect(contents[0]?.uri).toBe('ui://browser-engine/replay')
  })
})

describe('createReplayResource', () => {
  it('registers the replay resource and serves the HTML document', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' })
    const log = new ActionLog(10)
    log.record({ action: 'click', uid: 'btn-1', timestamp: 1 })
    const resource = createReplayResource(server, log, 'ui://browser-engine/replay')
    const served = await resource.read()
    expect(served.contents[0]?.uri).toBe('ui://browser-engine/replay')
    expect(served.contents[0]?.text).toContain('data-action="click"')
    expect(served.contents[0]?.mimeType).toBe('text/html;profile=mcp-app')

    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)
    await clientTransport.start()
    const responses: unknown[] = []
    clientTransport.onmessage = (message) => {
      responses.push(message)
    }
    await clientTransport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2026-07-28',
        capabilities: {},
        clientInfo: { name: 'test', version: '0.0.1' },
      },
    })
    await clientTransport.send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    await clientTransport.send({ jsonrpc: '2.0', id: 2, method: 'resources/list', params: {} })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 2,
          result: {
            resources: [
              {
                uri: 'ui://browser-engine/replay',
                name: 'browser-replay',
                mimeType: 'text/html;profile=mcp-app',
              },
            ],
          },
        }),
      ]),
    )
    await server.close()
  })
})
