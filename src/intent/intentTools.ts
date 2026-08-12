import { z } from 'zod'
import { definePageTool } from '../tools/defineTool.js'
import { ToolCategory } from '../tools/types.js'
import type { ToolDefinition } from '../tools/types.js'
import type { ContextPage } from '../context/ContextPage.js'
import type { DiffResult } from '../diff/diff.js'
import { explain, type ExplainTarget } from './explain.js'
import { runFlow, type FlowStep } from './runFlow.js'
import { verify, type Assertion } from './verify.js'
import { watchUntil, type WatchCondition } from './watchUntil.js'

function isContextPage(page: unknown): page is ContextPage {
  if (typeof page !== 'object' || page === null) {
    return false
  }
  return 'observe' in page && typeof page.observe === 'function'
}

function requirePage(page: unknown): ContextPage {
  if (!isContextPage(page)) {
    throw new Error('requires a page')
  }
  return page
}

function isWatchArgs(args: unknown): args is WatchCondition & { timeout: number } {
  return (
    typeof args === 'object' &&
    args !== null &&
    'kind' in args &&
    'value' in args &&
    'timeout' in args
  )
}

function isFlowArgs(args: unknown): args is { steps: FlowStep[] } {
  return typeof args === 'object' && args !== null && 'steps' in args && Array.isArray(args.steps)
}

function isVerifyArgs(args: unknown): args is Assertion {
  return typeof args === 'object' && args !== null && 'kind' in args
}

function isExplainArgs(args: unknown): args is ExplainTarget {
  return typeof args === 'object' && args !== null && 'kind' in args
}

function isDiffResult(value: unknown): value is DiffResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return 'added' in value && 'removed' in value && 'changed' in value
}

/** The M6 intent tools: watch_until, run_flow, verify, explain. */
export function buildIntentTools(): ToolDefinition[] {
  return [
    definePageTool({
      name: 'watch_until',
      description: 'Poll the page until a condition matches or the timeout elapses.',
      category: ToolCategory.Intent,
      inputSchema: z.object({
        kind: z.enum(['text', 'uid', 'role', 'event']),
        value: z.string(),
        timeout: z.number(),
      }),
      handler: async (args, _context, page) => {
        if (!isWatchArgs(args)) {
          throw new Error('invalid args')
        }
        const contextPage = requirePage(page)
        return watchUntil(
          async () => (await contextPage.observe()).snapshot,
          () => [],
          { kind: args.kind, value: args.value },
          { timeout: args.timeout },
        )
      },
    }),
    definePageTool({
      name: 'run_flow',
      description: 'Run a sequence of page actions as one flow.',
      category: ToolCategory.Intent,
      inputSchema: z.object({
        steps: z.array(
          z.object({
            action: z.string(),
            uid: z.string().optional(),
            text: z.string().optional(),
            dx: z.number().optional(),
            dy: z.number().optional(),
            value: z.string().optional(),
            key: z.string().optional(),
            url: z.string().optional(),
          }),
        ),
      }),
      handler: async (args, _context, page) => {
        if (!isFlowArgs(args)) {
          throw new Error('invalid args')
        }
        return runFlow(requirePage(page), args.steps)
      },
    }),
    definePageTool({
      name: 'verify',
      description: 'Assert a condition against the current snapshot and return evidence.',
      category: ToolCategory.Intent,
      readOnly: true,
      inputSchema: z.object({
        kind: z.enum(['uidExists', 'role', 'name', 'value', 'textContains']),
        uid: z.string().optional(),
        expected: z.string().optional(),
      }),
      handler: async (args, _context, page) => {
        if (!isVerifyArgs(args)) {
          throw new Error('invalid args')
        }
        const observed = await requirePage(page).observe()
        return verify(observed.snapshot, args)
      },
    }),
    definePageTool({
      name: 'explain',
      description: 'Explain a uid, region, or diff with a summary and annotation.',
      category: ToolCategory.Intent,
      readOnly: true,
      inputSchema: z.object({
        kind: z.enum(['uid', 'region', 'diff']),
        uid: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        diff: z.unknown().optional(),
      }),
      handler: async (args, _context, page) => {
        if (!isExplainArgs(args)) {
          throw new Error('invalid args')
        }
        const observed = await requirePage(page).observe()
        if (args.kind === 'diff') {
          const diff = 'diff' in args ? args.diff : undefined
          if (!isDiffResult(diff)) {
            throw new Error('invalid args')
          }
          return explain(observed.snapshot, observed.overlay, { kind: 'diff', diff })
        }
        return explain(observed.snapshot, observed.overlay, args)
      },
    }),
  ]
}
