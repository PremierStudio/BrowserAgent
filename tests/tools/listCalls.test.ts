import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { CallLog } from '../../src/tools/callTrace.js'
import { buildListCallsTool } from '../../src/tools/listCalls.js'
import { ToolCategory } from '../../src/tools/types.js'

describe('buildListCallsTool', () => {
  it('is a read-only observe tool', () => {
    const tool = buildListCallsTool(new CallLog(4))
    expect(tool.name).toBe('list_calls')
    expect(tool.category).toBe(ToolCategory.Observe)
    expect(tool.readOnly).toBe(true)
    expect(tool.inputSchema).toBeInstanceOf(z.ZodType)
    expect(tool.description).toMatch(/duration/i)
  })

  it('returns the recorded MCP calls in order', async () => {
    const log = new CallLog(8)
    log.record({ tool: 'observe', durationMs: 80, resultBytes: 1200, timestamp: 1 })
    log.record({ tool: 'run_flow', durationMs: 40, resultBytes: 30, timestamp: 2 })
    const tool = buildListCallsTool(log)
    await expect(tool.handler({}, { experimental: false })).resolves.toEqual({
      calls: [
        { tool: 'observe', durationMs: 80, resultBytes: 1200, timestamp: 1 },
        { tool: 'run_flow', durationMs: 40, resultBytes: 30, timestamp: 2 },
      ],
    })
  })
})
