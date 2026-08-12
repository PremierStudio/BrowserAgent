import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { definePageTool, defineTool } from '../../src/tools/defineTool.js'
import { ToolCategory } from '../../src/tools/types.js'

interface EchoArgs {
  value: string
}

function isEchoArgs(args: unknown): args is EchoArgs {
  return typeof args === 'object' && args !== null && 'value' in args
}

interface TitlePage {
  title: string
}

function isTitlePage(page: unknown): page is TitlePage {
  return typeof page === 'object' && page !== null && 'title' in page
}

describe('defineTool', () => {
  it('builds a tool definition with defaults', () => {
    const tool = defineTool({
      name: 'ping',
      description: 'Pings',
      category: ToolCategory.Observe,
      inputSchema: z.object({}),
      handler: async () => 'pong',
    })

    expect(tool.name).toBe('ping')
    expect(tool.description).toBe('Pings')
    expect(tool.category).toBe(ToolCategory.Observe)
    expect(tool.experimental).toBe(false)
    expect(tool.readOnly).toBe(false)
    expect(tool.inputSchema).toBeDefined()
  })

  it('honors explicit experimental and readOnly flags', () => {
    const tool = defineTool({
      name: 'x',
      description: 'd',
      category: ToolCategory.Action,
      experimental: true,
      readOnly: true,
      inputSchema: z.object({}),
      handler: async () => undefined,
    })

    expect(tool.experimental).toBe(true)
    expect(tool.readOnly).toBe(true)
  })

  it('invokes the handler with args and context', async () => {
    const tool = defineTool({
      name: 'echo',
      description: 'd',
      category: ToolCategory.Observe,
      inputSchema: z.object({ value: z.string() }),
      handler: async (args, context) => {
        if (!isEchoArgs(args)) {
          throw new Error('bad args')
        }
        return { value: args.value, experimental: context.experimental }
      },
    })

    const result = await tool.handler({ value: 'hi' }, { experimental: true })
    expect(result).toEqual({ value: 'hi', experimental: true })
  })
})

describe('definePageTool', () => {
  it('builds a page tool that passes the page to the handler', async () => {
    const tool = definePageTool({
      name: 'getTitle',
      description: 'd',
      category: ToolCategory.Observe,
      inputSchema: z.object({}),
      handler: async (_args, _context, page) => {
        if (!isTitlePage(page)) {
          throw new Error('bad page')
        }
        return page.title
      },
    })

    const result = await tool.handler({}, { experimental: false, page: { title: 'Hello' } })
    expect(result).toBe('Hello')
  })

  it('throws when a page tool is called without a page', async () => {
    const tool = definePageTool({
      name: 'needsPage',
      description: 'd',
      category: ToolCategory.Action,
      inputSchema: z.object({}),
      handler: async () => 'unused',
    })

    await expect(tool.handler({}, { experimental: false })).rejects.toThrow(/requires a page/)
  })
})
