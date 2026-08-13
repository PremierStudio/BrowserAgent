import { describe, expect, it } from 'vitest'
import { isPidAlive } from '../../src/browser/pidAlive.js'

describe('isPidAlive', () => {
  it('is true for this process and false for impossible pids', () => {
    expect(isPidAlive(process.pid)).toBe(true)
    expect(isPidAlive(0)).toBe(false)
    expect(isPidAlive(-1)).toBe(false)
    expect(isPidAlive(1.5)).toBe(false)
    expect(isPidAlive(2_147_483_647)).toBe(false)
  })
})
