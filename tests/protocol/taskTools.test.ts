import { describe, expect, it } from 'vitest'
import { buildTaskTools } from '../../src/protocol/taskTools.js'
import { TaskRunner, type WaitOptions } from '../../src/tasks/TaskRunner.js'
import { TaskStore } from '../../src/tasks/TaskStore.js'

function handlerFor(
  store: TaskStore,
  runner: TaskRunner,
  name: string,
):
  | ((args: unknown, ctx: { experimental: boolean; page?: unknown }) => Promise<unknown>)
  | undefined {
  return buildTaskTools(store, runner).find((tool) => tool.name === name)?.handler
}

function toolNamed(store: TaskStore, runner: TaskRunner, name: string) {
  const tool = buildTaskTools(store, runner).find((item) => item.name === name)
  expect(tool).toBeDefined()
  return tool
}

class RecordingRunner extends TaskRunner {
  seen: WaitOptions | undefined

  override async wait(id: string, options: WaitOptions) {
    this.seen = options
    return super.wait(id, options)
  }
}

describe('buildTaskTools', () => {
  it('returns get, list, cancel, and wait tools in deterministic order', () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new TaskRunner(store)
    expect(buildTaskTools(store, runner).map((tool) => tool.name)).toEqual([
      'get_task',
      'list_tasks',
      'cancel_task',
      'wait_task',
    ])
  })

  it('advertises exact descriptions, readOnly flags, and input schemas', () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new TaskRunner(store)
    const getTask = toolNamed(store, runner, 'get_task')
    const listTasks = toolNamed(store, runner, 'list_tasks')
    const cancelTask = toolNamed(store, runner, 'cancel_task')
    const waitTask = toolNamed(store, runner, 'wait_task')
    expect(getTask?.description).toBe('Get a task by id (Tasks extension fallback).')
    expect(listTasks?.description).toBe('List every task in the store (Tasks extension fallback).')
    expect(cancelTask?.description).toBe('Cancel a working task (Tasks extension fallback).')
    expect(waitTask?.description).toBe(
      'Block until a task reaches a terminal state or the timeout elapses.',
    )
    expect(getTask?.readOnly).toBe(true)
    expect(listTasks?.readOnly).toBe(true)
    expect(cancelTask?.readOnly).toBe(false)
    expect(waitTask?.readOnly).toBe(true)
    expect(getTask?.inputSchema.safeParse({ id: 'task-1' }).success).toBe(true)
    expect(getTask?.inputSchema.safeParse({}).success).toBe(false)
    expect(listTasks?.inputSchema.safeParse({}).success).toBe(true)
    expect(cancelTask?.inputSchema.safeParse({ id: 'task-1' }).success).toBe(true)
    expect(cancelTask?.inputSchema.safeParse({}).success).toBe(false)
    expect(waitTask?.inputSchema.safeParse({ id: 'task-1', timeout: 10 }).success).toBe(true)
    expect(waitTask?.inputSchema.safeParse({ id: 'task-1' }).success).toBe(false)
    expect(waitTask?.inputSchema.safeParse({ timeout: 10 }).success).toBe(false)
  })

  it('get_task returns the stored task', async () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new TaskRunner(store)
    store.create('run-flow')
    const result = await handlerFor(
      store,
      runner,
      'get_task',
    )?.({ id: 'task-1' }, { experimental: false })
    expect(result).toMatchObject({ id: 'task-1', name: 'run-flow', status: 'working' })
  })

  it('get_task throws for an unknown id', async () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new TaskRunner(store)
    await expect(
      handlerFor(store, runner, 'get_task')?.({ id: 'nope' }, { experimental: false }),
    ).rejects.toThrow(/unknown task/i)
  })

  it('get_task throws on invalid args', async () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new TaskRunner(store)
    const getTask = handlerFor(store, runner, 'get_task')
    for (const args of [null, undefined, 1, 'task-1', true, {}, { timeout: 1 }]) {
      await expect(getTask?.(args, { experimental: false })).rejects.toThrow(/invalid args/i)
    }
  })

  it('list_tasks returns every stored task', async () => {
    let n = 0
    const store = new TaskStore(() => `task-${(n += 1)}`)
    const runner = new TaskRunner(store)
    store.create('a')
    store.create('b')
    const result = await handlerFor(store, runner, 'list_tasks')?.({}, { experimental: false })
    expect(result).toEqual([
      { id: 'task-1', name: 'a', status: 'working' },
      { id: 'task-2', name: 'b', status: 'working' },
    ])
  })

  it('cancel_task cancels a working task', async () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new TaskRunner(store)
    store.create('run-flow')
    const result = await handlerFor(
      store,
      runner,
      'cancel_task',
    )?.({ id: 'task-1' }, { experimental: false })
    expect(result).toMatchObject({ id: 'task-1', status: 'cancelled' })
  })

  it('cancel_task throws on invalid args', async () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new TaskRunner(store)
    const cancel = handlerFor(store, runner, 'cancel_task')
    for (const args of [null, undefined, 1, 'task-1', true, {}, { timeout: 1 }]) {
      await expect(cancel?.(args, { experimental: false })).rejects.toThrow(/invalid args/i)
    }
  })

  it('wait_task returns a completed task', async () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new TaskRunner(store)
    await runner.run('run-flow', async () => ({ ok: true }))
    const result = await handlerFor(
      store,
      runner,
      'wait_task',
    )?.({ id: 'task-1', timeout: 1000 }, { experimental: false })
    expect(result).toMatchObject({ id: 'task-1', status: 'completed', result: { ok: true } })
  })

  it('wait_task forwards the timeout option to the runner', async () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new RecordingRunner(store)
    await runner.run('run-flow', async () => ({ ok: true }))
    await handlerFor(
      store,
      runner,
      'wait_task',
    )?.({ id: 'task-1', timeout: 1000 }, { experimental: false })
    expect(runner.seen).toEqual({ timeout: 1000 })
  })

  it('wait_task throws on invalid args', async () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new TaskRunner(store)
    const wait = handlerFor(store, runner, 'wait_task')
    for (const args of [null, undefined, 1, 'task-1', true, {}, { id: 'task-1' }, { timeout: 1 }]) {
      await expect(wait?.(args, { experimental: false })).rejects.toThrow(/invalid args/i)
    }
  })
})
