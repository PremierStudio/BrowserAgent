import { describe, expect, it } from 'vitest'
import { sum } from '../src/sum.js'

describe('sum', () => {
  it('adds two positive numbers', () => {
    expect(sum(2, 3)).toBe(5)
  })

  it('adds negative numbers', () => {
    expect(sum(-4, 1)).toBe(-3)
  })

  it('is commutative', () => {
    expect(sum(3, 2)).toBe(5)
  })

  it('handles zero', () => {
    expect(sum(0, 0)).toBe(0)
  })
})
