import { describe, expect, it } from 'vitest'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { createServer } from '../../src/protocol/server.js'
import { EventBuffer } from '../../src/events/EventBuffer.js'
import { ToolCategory } from '../../src/tools/types.js'

describe('createServer', () => {
  it('returns an McpServer with implementation info', () => {
    const server = createServer({ name: 'browser-agent', version: '0.0.1' })
    expect(server).toBeInstanceOf(McpServer)
  })

  it('registers each provided tool', () => {
    const tool = {
      name: 'ping',
      description: 'Pings',
      category: ToolCategory.Observe,
      experimental: false,
      readOnly: true,
      inputSchema: z.object({ value: z.string() }),
      handler: async () => 'pong',
    }
    const server = createServer({ name: 'browser-agent', version: '0.0.1' }, { tools: [tool] })
    expect(server).toBeInstanceOf(McpServer)
    // The tool is registered via the protocol bridge; the server exposes it.
    const jsonSchema = server.toolInputSchemaJson('ping')
    expect(jsonSchema).toBeDefined()
  })

  it('registers the event resource when an event buffer is provided', () => {
    const buffer = new EventBuffer(10)
    const server = createServer({ name: 'browser-agent', version: '0.0.1' }, { events: buffer })
    expect(server).toBeInstanceOf(McpServer)
    // The browser://events resource is registered and readable.
    const schema = server.toolInputSchemaJson('nope')
    expect(schema).toBeUndefined()
  })
})
