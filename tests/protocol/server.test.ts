import { describe, expect, it } from 'vitest'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { createServer } from '../../src/protocol/server.js'
import { ToolCategory } from '../../src/tools/types.js'

describe('createServer', () => {
  it('returns an McpServer with implementation info', () => {
    const server = createServer({ name: 'browser-agent', version: '0.0.1' }, [])
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
    const server = createServer({ name: 'browser-agent', version: '0.0.1' }, [tool])
    expect(server).toBeInstanceOf(McpServer)
    // The tool is registered via the protocol bridge; the server exposes it.
    const jsonSchema = server.toolInputSchemaJson('ping')
    expect(jsonSchema).toBeDefined()
  })
})
