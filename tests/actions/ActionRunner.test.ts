import { describe, expect, it } from 'vitest'
import { ActionLog } from '../../src/actions/ActionLog.js'
import { ActionRunner } from '../../src/actions/ActionRunner.js'

describe('ActionRunner', () => {
  it('performs the action, waits for stability, and logs it', async () => {
    const log = new ActionLog(10)
    let clicked = false
    let waited = false
    const runner = new ActionRunner(
      log,
      {
        wait: async () => {
          waited = true
          return true
        },
      },
      () => 100,
    )
    const result = await runner.run('click', 'loader-1_42', async () => {
      clicked = true
    })
    expect(clicked).toBe(true)
    expect(waited).toBe(true)
    expect(result).toBe(true)
    expect(log.all()).toEqual([{ action: 'click', uid: 'loader-1_42', timestamp: 100 }])
  })

  it('records a box when provided', async () => {
    const log = new ActionLog(10)
    const runner = new ActionRunner(log, { wait: async () => true }, () => 100)
    await runner.run('click', 'loader-1_42', async () => undefined, {
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    })
    expect(log.all()[0]?.box).toEqual({ x: 1, y: 2, width: 3, height: 4 })
  })

  it('returns false when the wait times out', async () => {
    const log = new ActionLog(10)
    const runner = new ActionRunner(log, { wait: async () => false }, () => 100)
    const result = await runner.run('click', 'loader-1_42', async () => undefined)
    expect(result).toBe(false)
    // The action is still logged even on a stability timeout.
    expect(log.all()).toHaveLength(1)
  })

  it('propagates action errors', async () => {
    const log = new ActionLog(10)
    const runner = new ActionRunner(log, { wait: async () => true }, () => 100)
    await expect(
      runner.run('click', 'loader-1_42', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
  })
})
