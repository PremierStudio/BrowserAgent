import { describe, expect, it } from 'vitest'
import {
  createActionWaiter,
  defaultClock,
  memoryMutationSource,
} from '../../src/context/waitAfterAction.js'

function advancingSleep(getNow: () => number, setNow: (next: number) => void) {
  let steps = 0
  return async (ms: number): Promise<void> => {
    steps += 1
    if (steps > 100) {
      throw new Error('wait loop exceeded')
    }
    setNow(getNow() + ms)
  }
}

describe('memoryMutationSource', () => {
  it('emit invokes every registered listener', () => {
    const source = memoryMutationSource()
    let first = 0
    let second = 0
    source.onMutation(() => {
      first += 1
    })
    source.onMutation(() => {
      second += 1
    })
    source.emit()
    expect(first).toBe(1)
    expect(second).toBe(1)
    source.emit()
    expect(first).toBe(2)
    expect(second).toBe(2)
  })

  it('emit with no listeners does not throw', () => {
    const source = memoryMutationSource()
    expect(() => {
      source.emit()
    }).not.toThrow()
  })
})

describe('createActionWaiter', () => {
  it('resolves true immediately when no mutations occur', async () => {
    const source = memoryMutationSource()
    let now = 0
    const { wait } = createActionWaiter(source, {
      quietPeriod: 100,
      timeout: 1000,
      clock: () => now,
      sleep: advancingSleep(
        () => now,
        (next) => {
          now = next
        },
      ),
    })
    await expect(wait()).resolves.toBe(true)
    expect(now).toBe(0)
  })

  it('resolves true after a mutation once the clock passes the quiet period', async () => {
    const source = memoryMutationSource()
    let now = 0
    const { wait } = createActionWaiter(source, {
      quietPeriod: 100,
      timeout: 1000,
      clock: () => now,
      sleep: advancingSleep(
        () => now,
        (next) => {
          now = next
        },
      ),
    })
    source.emit()
    await expect(wait()).resolves.toBe(true)
    expect(now).toBe(100)
  })

  it('resolves false when the clock passes timeout while mutations continue', async () => {
    const source = memoryMutationSource()
    let now = 0
    const { wait } = createActionWaiter(source, {
      quietPeriod: 100,
      timeout: 50,
      clock: () => now,
      sleep: async (ms: number): Promise<void> => {
        now += ms
        source.emit()
      },
    })
    source.emit()
    await expect(wait()).resolves.toBe(false)
    expect(now).toBeGreaterThanOrEqual(50)
    expect(now).toBeLessThan(100)
  })

  it('applies a throttle multiplier to the quiet period', async () => {
    const source = memoryMutationSource()
    let now = 0
    const { wait } = createActionWaiter(source, {
      quietPeriod: 100,
      timeout: 1000,
      throttle: 2,
      clock: () => now,
      sleep: advancingSleep(
        () => now,
        (next) => {
          now = next
        },
      ),
    })
    source.emit()
    await expect(wait()).resolves.toBe(true)
    expect(now).toBe(200)
  })

  it('uses defaultClock and default sleep when none are injected and the DOM is already quiet', async () => {
    const source = memoryMutationSource()
    const { wait } = createActionWaiter(source, { quietPeriod: 100, timeout: 1000 })
    await expect(wait()).resolves.toBe(true)
  })

  it('defaultClock returns the current epoch time', () => {
    expect(defaultClock()).toBeGreaterThan(0)
  })
})
