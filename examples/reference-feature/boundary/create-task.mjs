import { createTaskService } from '../domain/tasks.mjs';
import { authorize } from './authorize.mjs';

// Context must be supplied by a trusted server authentication integration.
export function createTaskBoundary(dependencies) {
  const createTask = createTaskService(dependencies);
  return async function execute(context, input) {
    const ownerId = authorize(context, 'task:create');
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).length !== 1 || !Object.hasOwn(input, 'title')
      || typeof input.title !== 'string') {
      throw new Error('VALIDATION_ERROR');
    }
    return createTask(input.title, ownerId);
  };
}
