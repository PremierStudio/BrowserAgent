import { describe, expect, it } from 'vitest'
import { ToolMutex } from '../../src/tools/ToolMutex.js'

describe('ToolMutex', () => {
  it('allows concurrent read-only operations', async () => {
    const mutex = new ToolMutex()
    const a = mutex.acquireRead()
    const b = mutex.acquireRead()
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(a).not.toBe(b)
  })

  it('blocks a write while reads are held', () => {
    const mutex = new ToolMutex()
    mutex.acquireRead()
    expect(mutex.acquireWrite()).toBe(false)
  })

  it('allows a write once all reads are released', () => {
    const mutex = new ToolMutex()
    const r1 = mutex.acquireRead()
    const r2 = mutex.acquireRead()
    mutex.releaseRead(r1 ?? '')
    mutex.releaseRead(r2 ?? '')
    expect(mutex.acquireWrite()).toBe(true)
  })

  it('blocks a second write while a write is held', () => {
    const mutex = new ToolMutex()
    expect(mutex.acquireWrite()).toBe(true)
    expect(mutex.acquireWrite()).toBe(false)
  })

  it('allows reads again after a write is released', () => {
    const mutex = new ToolMutex()
    mutex.acquireWrite()
    mutex.releaseWrite()
    expect(mutex.acquireRead()).toBeTruthy()
  })

  it('blocks reads while a write is held', () => {
    const mutex = new ToolMutex()
    mutex.acquireWrite()
    expect(mutex.acquireRead()).toBeNull()
  })

  it('releasing an unknown read token is a no-op', () => {
    const mutex = new ToolMutex()
    mutex.acquireRead()
    mutex.releaseRead('unknown-token')
    // The original read is still held, so a write is still blocked.
    expect(mutex.acquireWrite()).toBe(false)
  })

  it('tracks whether any write is currently held', () => {
    const mutex = new ToolMutex()
    expect(mutex.isWriteHeld()).toBe(false)
    mutex.acquireWrite()
    expect(mutex.isWriteHeld()).toBe(true)
    mutex.releaseWrite()
    expect(mutex.isWriteHeld()).toBe(false)
  })

  it('issues monotonically increasing read tokens', () => {
    const mutex = new ToolMutex()
    const seen = new Set<string>()
    let previous = -1
    for (let i = 0; i < 100; i += 1) {
      const token = mutex.acquireRead()
      expect(token).toBeTruthy()
      if (token === null) {
        throw new Error('expected a token')
      }
      expect(seen.has(token)).toBe(false)
      seen.add(token)
      const number = Number(token.slice('read-'.length))
      // Tokens must increase; a decrement would eventually collide or repeat.
      expect(number).toBeGreaterThan(previous)
      previous = number
    }
  })
})
