import { z } from 'zod'
import { defineTool } from '../tools/defineTool.js'
import { ToolCategory } from '../tools/types.js'
import type { ToolDefinition } from '../tools/types.js'
import type { TaskRunner } from '../tasks/TaskRunner.js'
import type { TaskStore } from '../tasks/TaskStore.js'

function isIdArgs(args: unknown): args is { id: string } {
  return typeof args === 'object' && args !== null && 'id' in args
}

function isWaitArgs(args: unknown): args is { id: string; timeout: number } {
  return isIdArgs(args) && 'timeout' in args
}

/** The Tasks extension fallback surface: get, list, cancel, and blocking wait. */
export function buildTaskTools(store: TaskStore, runner: TaskRunner): ToolDefinition[] {
  return [
    defineTool({
      name: 'get_task',
      description: 'Get a task by id (Tasks extension fallback).',
      category: ToolCategory.Observe,
      readOnly: true,
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        if (!isIdArgs(args)) {
          throw new Error('invalid args')
        }
        const task = store.get(args.id)
        if (task === undefined) {
          throw new Error(`Unknown task: ${args.id}`)
        }
        return task
      },
    }),
    defineTool({
      name: 'list_tasks',
      description: 'List every task in the store (Tasks extension fallback).',
      category: ToolCategory.Observe,
      readOnly: true,
      inputSchema: z.object({}),
      handler: async () => store.list(),
    }),
    defineTool({
      name: 'cancel_task',
      description: 'Cancel a working task (Tasks extension fallback).',
      category: ToolCategory.Action,
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        if (!isIdArgs(args)) {
          throw new Error('invalid args')
        }
        return store.cancel(args.id)
      },
    }),
    defineTool({
      name: 'wait_task',
      description: 'Block until a task reaches a terminal state or the timeout elapses.',
      category: ToolCategory.Observe,
      readOnly: true,
      inputSchema: z.object({ id: z.string(), timeout: z.number() }),
      handler: async (args) => {
        if (!isWaitArgs(args)) {
          throw new Error('invalid args')
        }
        return runner.wait(args.id, { timeout: args.timeout })
      },
    }),
  ]
}
