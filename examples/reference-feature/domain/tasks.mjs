/** @typedef {{ id: string, title: string, ownerId: string, completed: boolean }} Task */
/** @typedef {{ insert(task: Task): Promise<void>, completeOwned(id: string, ownerId: string): Promise<Task> }} TaskRepository */

/**
 * @param {{ repository: TaskRepository, newId: () => string }} dependencies
 */
export function createTaskService({ repository, newId }) {
  return async function createTask(title, ownerId) {
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
      throw new Error('INVALID_TITLE');
    }
    if (typeof ownerId !== 'string' || !ownerId.trim()) {
      throw new Error('INVALID_OWNER');
    }
    const task = { id: newId(), title: title.trim(), ownerId, completed: false };
    await repository.insert(task);
    return task;
  };
}

// Completion is idempotent. The repository must atomically enforce owner scope
// and transition to completed; persistence adapters must preserve this invariant.
export function completeTaskService({ repository }) {
  return async function completeTask(taskId, ownerId) {
    return repository.completeOwned(taskId, ownerId);
  };
}
