import { randomUUID } from 'node:crypto';
import { createTaskBoundary } from '../boundary/create-task.mjs';
import { MemoryTasks } from '../adapters/memory-tasks.mjs';

export function createDemoApp() {
  const repository = new MemoryTasks();
  return { execute: createTaskBoundary({ repository, newId: randomUUID }), repository };
}
