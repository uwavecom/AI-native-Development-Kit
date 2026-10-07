// Implements the TaskRepository port declared in domain/tasks.mjs.
export class MemoryTasks {
  #tasks = new Map();
  async insert(task) {
    if (this.#tasks.has(task.id)) throw new Error('CONFLICT');
    this.#tasks.set(task.id, { ...task });
  }
  async completeOwned(id, ownerId) {
    const task = this.#tasks.get(id);
    // Conceal the existence of other users' tasks.
    if (!task || task.ownerId !== ownerId) throw new Error('NOT_FOUND');
    task.completed = true;
    return { ...task };
  }
  snapshot() {
    return [...this.#tasks.values()].map(task => ({ ...task }));
  }
}
