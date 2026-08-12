import { z } from 'zod'
import { definePageTool } from '../tools/defineTool.js'
import { ToolCategory } from '../tools/types.js'
import type { ToolDefinition } from '../tools/types.js'
import { observeTool } from '../tools/observe.js'
import type { ContextPage } from '../context/ContextPage.js'

function isContextPage(page: unknown): page is ContextPage {
  if (typeof page !== 'object' || page === null) {
    return false
  }
  return 'click' in page && typeof page.click === 'function'
}

function isUidArgs(args: unknown): args is { uid: string } {
  return typeof args === 'object' && args !== null && 'uid' in args
}

function isTypeArgs(args: unknown): args is { uid: string; text: string } {
  return isUidArgs(args) && 'text' in args
}

function isScrollArgs(args: unknown): args is { uid: string; dx: number; dy: number } {
  return isUidArgs(args) && 'dx' in args && 'dy' in args
}

function isSelectArgs(args: unknown): args is { uid: string; value: string } {
  return isUidArgs(args) && 'value' in args
}

function isKeyArgs(args: unknown): args is { key: string } {
  return typeof args === 'object' && args !== null && 'key' in args
}

function isUrlArgs(args: unknown): args is { url: string } {
  return typeof args === 'object' && args !== null && 'url' in args
}

function requirePage(page: unknown): ContextPage {
  if (!isContextPage(page)) {
    throw new Error('requires a page')
  }
  return page
}

/** The standard page-aware tool set, in deterministic order. */
export function buildTools(): ToolDefinition[] {
  return [
    observeTool,
    clickTool,
    typeTool,
    hoverTool,
    scrollTool,
    selectTool,
    pressTool,
    navigateTool,
  ]
}

const clickTool = definePageTool({
  name: 'click',
  description: 'Click the element identified by uid.',
  category: ToolCategory.Action,
  inputSchema: z.object({ uid: z.string() }),
  handler: async (args, _context, page) => {
    if (!isUidArgs(args)) {
      throw new Error('invalid args')
    }
    await requirePage(page).click(args.uid)
    return { ok: true }
  },
})

const typeTool = definePageTool({
  name: 'type',
  description: 'Type text into the element identified by uid.',
  category: ToolCategory.Action,
  inputSchema: z.object({ uid: z.string(), text: z.string() }),
  handler: async (args, _context, page) => {
    if (!isTypeArgs(args)) {
      throw new Error('invalid args')
    }
    await requirePage(page).type(args.uid, args.text)
    return { ok: true }
  },
})

const hoverTool = definePageTool({
  name: 'hover',
  description: 'Hover over the element identified by uid.',
  category: ToolCategory.Action,
  inputSchema: z.object({ uid: z.string() }),
  handler: async (args, _context, page) => {
    if (!isUidArgs(args)) {
      throw new Error('invalid args')
    }
    await requirePage(page).hover(args.uid)
    return { ok: true }
  },
})

const scrollTool = definePageTool({
  name: 'scroll',
  description: 'Scroll by dx/dy within the element identified by uid.',
  category: ToolCategory.Action,
  inputSchema: z.object({ uid: z.string(), dx: z.number(), dy: z.number() }),
  handler: async (args, _context, page) => {
    if (!isScrollArgs(args)) {
      throw new Error('invalid args')
    }
    await requirePage(page).scroll(args.uid, args.dx, args.dy)
    return { ok: true }
  },
})

const selectTool = definePageTool({
  name: 'select',
  description: 'Select a value in the element identified by uid.',
  category: ToolCategory.Action,
  inputSchema: z.object({ uid: z.string(), value: z.string() }),
  handler: async (args, _context, page) => {
    if (!isSelectArgs(args)) {
      throw new Error('invalid args')
    }
    await requirePage(page).select(args.uid, args.value)
    return { ok: true }
  },
})

const pressTool = definePageTool({
  name: 'press',
  description: 'Press a key on the page.',
  category: ToolCategory.Action,
  inputSchema: z.object({ key: z.string() }),
  handler: async (args, _context, page) => {
    if (!isKeyArgs(args)) {
      throw new Error('invalid args')
    }
    await requirePage(page).press(args.key)
    return { ok: true }
  },
})

const navigateTool = definePageTool({
  name: 'navigate',
  description: 'Navigate the page to a URL.',
  category: ToolCategory.Navigation,
  inputSchema: z.object({ url: z.string() }),
  handler: async (args, _context, page) => {
    if (!isUrlArgs(args)) {
      throw new Error('invalid args')
    }
    await requirePage(page).navigate(args.url)
    return { ok: true }
  },
})
