import { describe, expect, it } from 'vitest'
import { ToolCategory } from '../../src/tools/types.js'

describe('ToolCategory', () => {
  it('exposes the expected categories', () => {
    expect(ToolCategory.Observe).toBe('observe')
    expect(ToolCategory.Action).toBe('action')
    expect(ToolCategory.Navigation).toBe('navigation')
    expect(ToolCategory.Intent).toBe('intent')
  })
})
