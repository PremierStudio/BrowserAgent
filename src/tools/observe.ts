import { z } from 'zod'
import { definePageTool } from './defineTool.js'
import { ToolCategory } from './types.js'
import type { ContextPage } from '../context/ContextPage.js'

function isContextPage(page: unknown): page is ContextPage {
  if (typeof page !== 'object' || page === null) {
    return false
  }
  return 'observe' in page && typeof page.observe === 'function'
}

/**
 * The unified observe primitive: returns the a11y snapshot, a screenshot, and
 * the uid → pixel box overlay in one call. Read-only, so it may run
 * concurrently with other observations.
 */
export const observeTool = definePageTool({
  name: 'observe',
  description: 'Observe the current page: a11y snapshot, screenshot, and uid→box overlay.',
  category: ToolCategory.Observe,
  readOnly: true,
  inputSchema: z.object({}),
  handler: async (_args, _context, page) => {
    if (!isContextPage(page)) {
      throw new Error('observe requires a ContextPage')
    }
    return page.observe()
  },
})
