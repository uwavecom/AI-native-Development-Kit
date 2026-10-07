import { randomUUID } from 'node:crypto';
import { createTaskBoundary } from '../boundary/create-task.mjs';
import { MemoryTasks } from '../adapters/memory-tasks.mjs';
import { completeTaskBoundary } from '../boundary/complete-task.mjs';

export function createDemoApp() {
  const repository = new MemoryTasks();
  return {
    execute: createTaskBoundary({ repository, newId: randomUUID }),
    complete: completeTaskBoundary({ repository }),
    repository,
  };
}
