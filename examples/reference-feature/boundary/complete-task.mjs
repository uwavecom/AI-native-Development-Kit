import { completeTaskService } from '../domain/tasks.mjs';
import { authorize } from './authorize.mjs';

export function completeTaskBoundary(dependencies) {
  const completeTask = completeTaskService(dependencies);
  return async function execute(context, input) {
    const ownerId = authorize(context, 'task:complete');
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).length !== 1 || !Object.hasOwn(input, 'taskId')
      || typeof input.taskId !== 'string' || !input.taskId.trim()
      || input.taskId.length > 128) {
      throw new Error('VALIDATION_ERROR');
    }
    return completeTask(input.taskId, ownerId);
  };
}
