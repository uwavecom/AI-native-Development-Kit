// Implements the TaskRepository port declared in domain/tasks.mjs.
export class MemoryTasks {
  #tasks = new Map();
  async insert(task) {
    if (this.#tasks.has(task.id)) throw new Error('CONFLICT');
    this.#tasks.set(task.id, { ...task });
  }
  snapshot() {
    return [...this.#tasks.values()].map(task => ({ ...task }));
  }
}
