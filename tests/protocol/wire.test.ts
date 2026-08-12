import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { McpServer, InMemoryTransport } from '@modelcontextprotocol/server'
import { registerTools } from '../../src/protocol/tools.js'
import type { ToolDefinition } from '../../src/tools/types.js'

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'ping',
    description: 'Pings',
    category: 'observe',
    experimental: false,
    readOnly: true,
    inputSchema: z.object({ value: z.string() }),
    handler: async () => 'pong',
    ...overrides,
  }
}

describe('registerTools over the wire', () => {
  it('dispatches a tools/call request to the tool caller', async () => {
    const server = new McpServer(
      { name: 'test', version: '0.0.1' },
      { capabilities: { tools: {} } },
    )
    const calls: string[] = []
    registerTools(server, [makeTool({ name: 'ping' })], {
      call: async (name, args) => {
        calls.push(name)
        return { name, args }
      },
    })

    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)
    await clientTransport.start()

    const responses: unknown[] = []
    clientTransport.onmessage = (message) => {
      responses.push(message)
    }

    // Send an initialize request, then a tools/call.
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
    await clientTransport.send({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    })
    await clientTransport.send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'ping', arguments: { value: 'x' } },
    })

    // Give the in-memory transport a tick to process the request.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toEqual(['ping'])
    expect(responses.length).toBeGreaterThan(0)
  })
})
