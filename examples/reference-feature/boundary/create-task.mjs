import { createTaskService } from '../domain/tasks.mjs';

// Context must be supplied by a trusted server authentication integration.
export function createTaskBoundary(dependencies) {
  const createTask = createTaskService(dependencies);
  return async function execute(context, input) {
    if (!context || typeof context.userId !== 'string' || !context.userId.trim()) {
      throw new Error('UNAUTHENTICATED');
    }
    if (!Array.isArray(context.permissions) || !context.permissions.includes('task:create')) {
      throw new Error('FORBIDDEN');
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).length !== 1 || !Object.hasOwn(input, 'title')
      || typeof input.title !== 'string') {
      throw new Error('VALIDATION_ERROR');
    }
    return createTask(input.title, context.userId);
  };
}
