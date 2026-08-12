import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineTool } from '../../src/tools/defineTool.js'
import { ToolHandler } from '../../src/tools/ToolHandler.js'
import { ToolCategory } from '../../src/tools/types.js'

function makeTool(overrides: Partial<Parameters<typeof defineTool>[0]> = {}) {
  return defineTool({
    name: 'test',
    description: 'd',
    category: ToolCategory.Observe,
    inputSchema: z.object({ value: z.string() }),
    handler: async (args) => {
      if (typeof args !== 'object' || args === null || !('value' in args)) {
        throw new Error('bad args')
      }
      return { got: String(args.value) }
    },
    ...overrides,
  })
}

describe('ToolHandler', () => {
  it('registers tools and lists them in registration order', () => {
    const handler = new ToolHandler()
    const a = makeTool({ name: 'a' })
    const b = makeTool({ name: 'b' })
    handler.register(a)
    handler.register(b)
    expect(handler.list().map((t) => t.name)).toEqual(['a', 'b'])
  })

  it('rejects unknown tool names', async () => {
    const handler = new ToolHandler()
    await expect(handler.call('nope', {})).rejects.toThrow(/unknown tool/i)
  })

  it('rejects tools in a disabled category', async () => {
    const handler = new ToolHandler()
    handler.register(makeTool({ name: 'act', category: ToolCategory.Action }))
    handler.setCategoryEnabled(ToolCategory.Action, false)
    await expect(handler.call('act', {})).rejects.toThrow(/disabled category/i)
  })

  it('rejects experimental tools when experimental is disabled', async () => {
    const handler = new ToolHandler()
    handler.register(makeTool({ name: 'exp', experimental: true }))
    await expect(handler.call('exp', {})).rejects.toThrow(/experimental/i)
  })

  it('allows experimental tools when experimental is enabled', async () => {
    const handler = new ToolHandler()
    handler.register(makeTool({ name: 'exp', experimental: true }))
    handler.setExperimentalEnabled(true)
    const result = await handler.call('exp', { value: 'x' })
    expect(result).toEqual({ got: 'x' })
  })

  it('passes the experimental flag through to the handler context', async () => {
    const handler = new ToolHandler()
    handler.register(
      makeTool({
        name: 'flag',
        handler: async (_args, context) => ({ experimental: context.experimental }),
      }),
    )
    handler.setExperimentalEnabled(true)
    const result = await handler.call('flag', { value: 'x' })
    expect(result).toEqual({ experimental: true })
  })

  it('rejects unknown arguments', async () => {
    const handler = new ToolHandler()
    handler.register(makeTool())
    await expect(handler.call('test', { value: 'x', extra: 1 })).rejects.toThrow(
      /unrecognized|unknown/i,
    )
  })

  it('invokes the handler with parsed args', async () => {
    const handler = new ToolHandler()
    handler.register(makeTool())
    const result = await handler.call('test', { value: 'hello' })
    expect(result).toEqual({ got: 'hello' })
  })

  it('serializes write tools through the mutex', async () => {
    const handler = new ToolHandler()
    let active = 0
    let maxActive = 0
    handler.register(
      makeTool({
        name: 'write',
        category: ToolCategory.Action,
        handler: async () => {
          active += 1
          maxActive = Math.max(maxActive, active)
          await new Promise((r) => setTimeout(r, 5))
          active -= 1
          return 'done'
        },
      }),
    )
    await Promise.all([
      handler.call('write', { value: 'x' }),
      handler.call('write', { value: 'y' }),
    ])
    expect(maxActive).toBe(1)
  })

  it('runs read-only tools concurrently', async () => {
    const handler = new ToolHandler()
    let active = 0
    let maxActive = 0
    handler.register(
      makeTool({
        name: 'read',
        readOnly: true,
        handler: async () => {
          active += 1
          maxActive = Math.max(maxActive, active)
          await new Promise((r) => setTimeout(r, 5))
          active -= 1
          return 'done'
        },
      }),
    )
    await Promise.all([handler.call('read', { value: 'x' }), handler.call('read', { value: 'y' })])
    expect(maxActive).toBe(2)
  })

  it('releases the read lock after a read-only tool completes', async () => {
    const handler = new ToolHandler()
    handler.register(makeTool({ name: 'read', readOnly: true }))
    handler.register(makeTool({ name: 'write', category: ToolCategory.Action }))
    await handler.call('read', { value: 'x' })
    // If the read lock were not released, the write could not acquire.
    await expect(handler.call('write', { value: 'x' })).resolves.toEqual({ got: 'x' })
  })

  it('propagates handler errors', async () => {
    const handler = new ToolHandler()
    handler.register(
      makeTool({
        handler: async () => {
          throw new Error('boom')
        },
      }),
    )
    await expect(handler.call('test', { value: 'x' })).rejects.toThrow('boom')
  })

  it('re-enables a previously disabled category', async () => {
    const handler = new ToolHandler()
    handler.register(makeTool({ name: 'act', category: ToolCategory.Action }))
    handler.setCategoryEnabled(ToolCategory.Action, false)
    await expect(handler.call('act', {})).rejects.toThrow(/disabled category/i)
    handler.setCategoryEnabled(ToolCategory.Action, true)
    await expect(handler.call('act', { value: 'x' })).resolves.toEqual({ got: 'x' })
  })

  it('rejects a read-only tool when a write lock is held', async () => {
    const handler = new ToolHandler()
    handler.register(makeTool({ name: 'read', readOnly: true }))
    handler.register(
      makeTool({
        name: 'write',
        category: ToolCategory.Action,
        handler: async () => {
          // Hold the write lock while a read tries to acquire.
          await new Promise((r) => setTimeout(r, 20))
          return 'done'
        },
      }),
    )
    const writePromise = handler.call('write', { value: 'x' })
    // Give the write a moment to acquire the lock.
    await new Promise((r) => setTimeout(r, 5))
    await expect(handler.call('read', { value: 'x' })).rejects.toThrow(/read lock/i)
    await writePromise
  })

  it('rejects a write tool when a read lock is held', async () => {
    const handler = new ToolHandler()
    handler.register(makeTool({ name: 'read', readOnly: true }))
    handler.register(makeTool({ name: 'write', category: ToolCategory.Action }))
    const readPromise = handler.call('read', { value: 'x' })
    // The read handler resolves immediately; hold the read lock via a slow read.
    await readPromise
    // Register a slow read to hold the lock while a write is attempted.
    handler.register(
      makeTool({
        name: 'slowRead',
        readOnly: true,
        handler: async () => {
          await new Promise((r) => setTimeout(r, 20))
          return 'done'
        },
      }),
    )
    const slowRead = handler.call('slowRead', { value: 'x' })
    await new Promise((r) => setTimeout(r, 5))
    await expect(handler.call('write', { value: 'x' })).rejects.toThrow(/write lock/i)
    await slowRead
  })

  it('handles a non-object schema without strict parsing', async () => {
    const handler = new ToolHandler()
    handler.register(
      makeTool({
        inputSchema: z.string(),
        handler: async (args) => ({ got: args }),
      }),
    )
    const result = await handler.call('test', 'plain-string')
    expect(result).toEqual({ got: 'plain-string' })
  })

  it('passes the injected page through to the handler context', async () => {
    const handler = new ToolHandler()
    handler.register(
      makeTool({
        name: 'pageAware',
        handler: async (_args, context) => ({ page: context.page }),
      }),
    )
    handler.setPage({ url: 'https://example.com' })
    const result = await handler.call('pageAware', { value: 'x' })
    expect(result).toEqual({ page: { url: 'https://example.com' } })
  })

  it('omits the page from context when none is set', async () => {
    const handler = new ToolHandler()
    handler.register(
      makeTool({
        name: 'noPage',
        handler: async (_args, context) => ({ hasPage: context.page !== undefined }),
      }),
    )
    const result = await handler.call('noPage', { value: 'x' })
    expect(result).toEqual({ hasPage: false })
  })
})
