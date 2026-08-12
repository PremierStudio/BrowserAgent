import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  initServer,
  registerTools,
  toToolAnnotations,
  type ToolCaller,
} from '../../src/protocol/tools.js'
import type { ToolDefinition } from '../../src/tools/types.js'

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'ping',
    description: 'Pings',
    category: 'observe',
    experimental: false,
    readOnly: true,
    inputSchema: z.object({}),
    handler: async () => 'pong',
    ...overrides,
  }
}

function makeCaller(): ToolCaller {
  return { call: async () => 'pong' }
}

describe('toToolAnnotations', () => {
  it('marks read-only tools with readOnlyHint', () => {
    expect(toToolAnnotations(true)).toEqual({ readOnlyHint: true })
  })

  it('marks write tools with destructiveHint', () => {
    expect(toToolAnnotations(false)).toEqual({ destructiveHint: true })
  })
})

describe('registerTools', () => {
  it('registers each tool with the server', () => {
    const tool = makeTool({ name: 'ping', description: 'Pings', readOnly: true })
    const registered: string[] = []
    const server = {
      registerTool(name: string, _config: unknown): void {
        registered.push(name)
      },
    }
    registerTools(server, [tool], makeCaller())
    expect(registered).toEqual(['ping'])
  })

  it('passes the converted schema and annotations to registerTool', () => {
    const tool = makeTool({ name: 'ping', description: 'Pings', readOnly: true })
    let captured: { name: string; config: Record<string, unknown> } | undefined
    const server = {
      registerTool(name: string, config: Record<string, unknown>): void {
        captured = { name, config }
      },
    }
    registerTools(server, [tool], makeCaller())
    expect(captured?.name).toBe('ping')
    expect(captured?.config.description).toBe('Pings')
    expect(captured?.config.annotations).toEqual({ readOnlyHint: true })
    expect(captured?.config.inputSchema).toBeDefined()
  })

  it('dispatches the callback to the tool handler', async () => {
    const tool = makeTool({ name: 'ping', description: 'Pings', readOnly: true })
    let callback: ((args: unknown) => Promise<unknown>) | undefined
    const server = {
      registerTool(
        _name: string,
        _config: Record<string, unknown>,
        cb: (args: unknown) => Promise<unknown>,
      ): void {
        callback = cb
      },
    }
    registerTools(server, [tool], { call: async () => 'pong' })
    expect(callback).toBeDefined()
    await expect(callback?.({})).resolves.toBe('pong')
  })
})

describe('initServer', () => {
  it('creates a server with the implementation info', () => {
    const server = initServer('browser-agent', '0.0.1')
    expect(server).toBeDefined()
  })
})
