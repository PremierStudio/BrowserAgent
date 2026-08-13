import { z } from 'zod'
import type { BrowserController } from '../browser/browserDesk.js'
import { isPlainObject } from '../browser/instanceRegistry.js'
import { defineTool } from './defineTool.js'
import { ToolCategory } from './types.js'
import type { ToolDefinition } from './types.js'

function optionalUrl(args: unknown): string | undefined {
  if (!isPlainObject(args) || typeof args.url !== 'string') {
    return undefined
  }
  return args.url
}

function requiredId(args: unknown): string {
  if (!isPlainObject(args) || typeof args.id !== 'string' || args.id === '') {
    throw new Error('id is required')
  }
  return args.id
}

/** browser_status, open, close, reap, and tab tools. */
export function buildBrowserDeskTools(controller: BrowserController): ToolDefinition[] {
  return [
    defineTool({
      name: 'browser_status',
      description:
        'List this MCP Chrome, peers, orphans, and closed instances. Does not open Chrome.',
      category: ToolCategory.Observe,
      readOnly: true,
      inputSchema: z.object({}),
      handler: async () => controller.status(),
    }),
    defineTool({
      name: 'browser_open',
      description: 'Open this MCP Chrome. Safe when already open.',
      category: ToolCategory.Action,
      inputSchema: z.object({}),
      handler: async () => controller.open(),
    }),
    defineTool({
      name: 'browser_close',
      description: 'Close this MCP Chrome and mark it closed in the registry.',
      category: ToolCategory.Action,
      inputSchema: z.object({}),
      handler: async () => controller.close(),
    }),
    defineTool({
      name: 'browser_reap',
      description: 'Kill leftover Chrome whose MCP agent is gone.',
      category: ToolCategory.Action,
      inputSchema: z.object({}),
      handler: async () => controller.reap(),
    }),
    defineTool({
      name: 'browser_new_tab',
      description: 'Open a new tab. Pass url to navigate. Opens Chrome first if needed.',
      category: ToolCategory.Action,
      inputSchema: z.object({
        url: z.string().optional(),
      }),
      handler: async (args) => controller.newTab(optionalUrl(args)),
    }),
    defineTool({
      name: 'browser_close_tab',
      description: 'Close a tab by id from browser_status. Refuses to close the last tab.',
      category: ToolCategory.Action,
      inputSchema: z.object({
        id: z.string(),
      }),
      handler: async (args) => controller.closeTab(requiredId(args)),
    }),
    defineTool({
      name: 'browser_switch_tab',
      description: 'Switch this MCP Chrome to the tab id from browser_status.',
      category: ToolCategory.Action,
      inputSchema: z.object({
        id: z.string(),
      }),
      handler: async (args) => controller.switchTab(requiredId(args)),
    }),
  ]
}
