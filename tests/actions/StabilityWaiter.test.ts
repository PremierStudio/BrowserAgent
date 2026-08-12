import { describe, expect, it } from 'vitest'
import {
  StabilityWaiter,
  defaultSleep,
  type MutationSource,
} from '../../src/actions/StabilityWaiter.js'

function makeSource(): MutationSource & { mutate: () => void } {
  let handler: (() => void) | undefined
  return {
    onMutation(fn: () => void): void {
      handler = fn
    },
    mutate(): void {
      handler?.()
    },
  }
}

describe('StabilityWaiter', () => {
  it('is stable when no mutation has ever occurred', () => {
    const source = makeSource()
    const waiter = new StabilityWaiter(source, { quietPeriod: 100, timeout: 1000 }, () => 0)
    expect(waiter.check(0)).toBe('stable')
  })

  it('is waiting during the quiet period after a mutation', () => {
    const source = makeSource()
    const waiter = new StabilityWaiter(source, { quietPeriod: 100, timeout: 1000 }, () => 0)
    source.mutate()
    expect(waiter.check(50)).toBe('waiting')
  })

  it('is stable once the quiet period has elapsed', () => {
    const source = makeSource()
    const waiter = new StabilityWaiter(source, { quietPeriod: 100, timeout: 1000 }, () => 0)
    source.mutate()
    expect(waiter.check(110)).toBe('stable')
  })

  it('is timed out past the timeout', () => {
    const source = makeSource()
    let now = 0
    const waiter = new StabilityWaiter(source, { quietPeriod: 100, timeout: 200 }, () => now)
    // The wait begins at 0.
    expect(waiter.check(0)).toBe('stable')
    // A mutation at 200ms keeps the DOM unstable; at 250ms the timeout (200ms
    // from start) has elapsed but the quiet period (100ms) has not.
    now = 200
    source.mutate()
    expect(waiter.check(250)).toBe('timeout')
  })

  it('times out when elapsed time equals the timeout while still noisy', () => {
    const source = makeSource()
    let now = 0
    const waiter = new StabilityWaiter(source, { quietPeriod: 100, timeout: 200 }, () => now)
    expect(waiter.check(0)).toBe('stable')
    now = 150
    source.mutate()
    expect(waiter.check(200)).toBe('timeout')
  })

  it('measures timeout from a non-zero start, not now plus start', () => {
    const source = makeSource()
    let now = 1000
    const waiter = new StabilityWaiter(source, { quietPeriod: 100, timeout: 200 }, () => now)
    expect(waiter.check(1000)).toBe('stable')
    now = 1040
    source.mutate()
    expect(waiter.check(1050)).toBe('waiting')
  })

  it('applies a throttling multiplier to the quiet period', () => {
    const source = makeSource()
    const waiter = new StabilityWaiter(
      source,
      { quietPeriod: 100, timeout: 1000, throttle: 2 },
      () => 0,
    )
    source.mutate()
    // With throttle 2, the quiet period is 200ms.
    expect(waiter.check(150)).toBe('waiting')
    expect(waiter.check(210)).toBe('stable')
  })

  it('prefers stability over timeout when both are reached', () => {
    const source = makeSource()
    const waiter = new StabilityWaiter(source, { quietPeriod: 100, timeout: 200 }, () => 0)
    source.mutate()
    // At 250ms both the quiet period (100ms) and timeout (200ms) have elapsed;
    // stability wins.
    expect(waiter.check(250)).toBe('stable')
  })

  it('wait() resolves true once the DOM stabilizes', async () => {
    const source = makeSource()
    let now = 0
    const waiter = new StabilityWaiter(source, { quietPeriod: 100, timeout: 1000 }, () => now)
    const sleep = async (ms: number): Promise<void> => {
      now += ms
    }
    const promise = waiter.wait(sleep)
    now = 10
    source.mutate()
    // The loop sleeps in 20ms steps; after enough steps the quiet period
    // elapses and wait() resolves true.
    await expect(promise).resolves.toBe(true)
  })

  it('wait() resolves false on timeout', async () => {
    const source = makeSource()
    let now = 0
    const waiter = new StabilityWaiter(source, { quietPeriod: 100, timeout: 50 }, () => now)
    // A mutation before wait() starts keeps the DOM unstable.
    now = 10
    source.mutate()
    const sleep = async (ms: number): Promise<void> => {
      now += ms
    }
    // The timeout (50ms) elapses before the quiet period (100ms), so wait()
    // resolves false.
    await expect(waiter.wait(sleep)).resolves.toBe(false)
  })

  it('defaultSleep resolves', async () => {
    await expect(defaultSleep(1)).resolves.toBeUndefined()
  })
})
