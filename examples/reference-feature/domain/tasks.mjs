/** @typedef {{ id: string, title: string, ownerId: string }} Task */
/** @typedef {{ insert(task: Task): Promise<void> }} TaskRepository */

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
    const task = { id: newId(), title: title.trim(), ownerId };
    await repository.insert(task);
    return task;
  };
}
