import { z } from 'zod'
import { definePageTool } from './defineTool.js'
import { ToolCategory } from './types.js'
import type { ContextPage } from '../context/ContextPage.js'
import { outlineFromUnknown } from '../snapshot/outline.js'

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
  description:
    'Read the page. Prefer run_flow with name/role/near. detail=outline for labels, detail=full for a screenshot.',
  category: ToolCategory.Observe,
  readOnly: true,
  inputSchema: z.object({
    detail: z.enum(['full', 'outline']).optional(),
  }),
  handler: async (args, _context, page) => {
    if (!isContextPage(page)) {
      throw new Error('observe requires a ContextPage')
    }
    const observed = await page.observe()
    if (requestedDetail(args) !== 'outline') {
      return observed
    }
    return {
      pageState: observed.pageState,
      outline: outlineFromUnknown(observed.snapshot),
    }
  },
})

function requestedDetail(args: unknown): unknown {
  if (typeof args !== 'object' || args === null || !('detail' in args)) {
    return undefined
  }
  return args.detail
}
