/** The lifecycle statuses of a task (decision #2). */
type TaskStatus = 'working' | 'input_required' | 'completed' | 'failed' | 'cancelled'

/** A task managed by the store. */
export interface Task {
  id: string
  name: string
  status: TaskStatus
  result?: unknown
  error?: string
}

/** A patch applied to a task on update. */
export interface TaskUpdate {
  status?: TaskStatus
  result?: unknown
  error?: string
}

/** An id generator (injectable for deterministic tests). */
export type IdGenerator = () => string

function defaultId(): string {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Manages the lifecycle of long-running tasks (decision #2). Tasks start in
 * the working state and transition to completed, failed, cancelled, or
 * input_required. The id generator is injected so tests are deterministic.
 */
export class TaskStore {
  private readonly tasks = new Map<string, Task>()
  private readonly nextId: IdGenerator

  constructor(nextId: IdGenerator = defaultId) {
    this.nextId = nextId
  }

  create(name: string): Task {
    const task: Task = { id: this.nextId(), name, status: 'working' }
    this.tasks.set(task.id, task)
    return task
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  update(id: string, patch: TaskUpdate): Task {
    const task = this.tasks.get(id)
    if (task === undefined) {
      throw new Error(`Unknown task: ${id}`)
    }
    const updated: Task = { ...task, ...patch }
    this.tasks.set(id, updated)
    return updated
  }

  cancel(id: string): Task {
    return this.update(id, { status: 'cancelled' })
  }

  list(): Task[] {
    return [...this.tasks.values()]
  }
}
