import { describe, expect, it } from 'vitest'
import { buildTaskTools } from '../../src/protocol/taskTools.js'
import { TaskRunner } from '../../src/tasks/TaskRunner.js'
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
    await expect(
      handlerFor(store, runner, 'get_task')?.({}, { experimental: false }),
    ).rejects.toThrow(/invalid args/i)
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
    await expect(
      handlerFor(store, runner, 'cancel_task')?.({}, { experimental: false }),
    ).rejects.toThrow(/invalid args/i)
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

  it('wait_task throws on invalid args', async () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new TaskRunner(store)
    await expect(
      handlerFor(store, runner, 'wait_task')?.({ id: 'task-1' }, { experimental: false }),
    ).rejects.toThrow(/invalid args/i)
  })
})
