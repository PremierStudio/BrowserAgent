import { describe, expect, it } from 'vitest'
import { TaskStore } from '../../src/tasks/TaskStore.js'

describe('TaskStore', () => {
  it('creates a task in the working state', () => {
    const store = new TaskStore()
    const task = store.create('run-flow')
    expect(task.id).toBeDefined()
    expect(task.status).toBe('working')
    expect(task.name).toBe('run-flow')
  })

  it('returns a task by id', () => {
    const store = new TaskStore()
    const created = store.create('run-flow')
    const task = store.get(created.id)
    expect(task).toBeDefined()
    expect(task?.id).toBe(created.id)
  })

  it('returns undefined for an unknown task id', () => {
    const store = new TaskStore()
    expect(store.get('nope')).toBeUndefined()
  })

  it('updates a task status to completed with a result', () => {
    const store = new TaskStore()
    const created = store.create('run-flow')
    const updated = store.update(created.id, { status: 'completed', result: { ok: true } })
    expect(updated.status).toBe('completed')
    expect(updated.result).toEqual({ ok: true })
  })

  it('updates a task to failed with an error', () => {
    const store = new TaskStore()
    const created = store.create('run-flow')
    const updated = store.update(created.id, { status: 'failed', error: 'boom' })
    expect(updated.status).toBe('failed')
    expect(updated.error).toBe('boom')
  })

  it('updates a task to input_required', () => {
    const store = new TaskStore()
    const created = store.create('run-flow')
    const updated = store.update(created.id, { status: 'input_required' })
    expect(updated.status).toBe('input_required')
  })

  it('cancels a task', () => {
    const store = new TaskStore()
    const created = store.create('run-flow')
    const updated = store.cancel(created.id)
    expect(updated.status).toBe('cancelled')
  })

  it('throws when updating an unknown task', () => {
    const store = new TaskStore()
    expect(() => store.update('nope', { status: 'completed' })).toThrow(/unknown task/i)
  })

  it('throws when cancelling an unknown task', () => {
    const store = new TaskStore()
    expect(() => store.cancel('nope')).toThrow(/unknown task/i)
  })

  it('lists all tasks', () => {
    const store = new TaskStore()
    store.create('a')
    store.create('b')
    expect(store.list()).toHaveLength(2)
  })

  it('generates unique task ids', () => {
    const store = new TaskStore()
    const a = store.create('a')
    const b = store.create('b')
    expect(a.id).not.toBe(b.id)
  })

  it('default ids are task-<base36>-<6 alphanumerics> with no decimal prefix', () => {
    const store = new TaskStore()
    const ids = [store.create('a').id, store.create('b').id, store.create('c').id]
    for (const id of ids) {
      expect(id).toMatch(/^task-[0-9a-z]+-[0-9a-z]{6}$/)
      expect(id.includes('.')).toBe(false)
    }
    expect(new Set(ids).size).toBe(ids.length)
  })
})
