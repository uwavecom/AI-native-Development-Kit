import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApp } from '../examples/reference-feature/composition/app.mjs';

const owner = { userId: 'owner', permissions: ['task:create', 'task:complete'] };

test('owner completes a task; repeated and concurrent completion is idempotent', async () => {
  const app = createDemoApp();
  const task = await app.execute(owner, { title: 'Report' });
  assert.equal(task.completed, false);
  const results = await Promise.all([
    app.complete(owner, { taskId: task.id }),
    app.complete(owner, { taskId: task.id }),
  ]);
  assert.deepEqual(results[0], { ...task, completed: true });
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(await app.complete(owner, { taskId: task.id }), results[0]);
  results[0].completed = false;
  assert.equal(app.repository.snapshot()[0].completed, true);
});

for (const [name, context, makeInput, error] of [
  ['anonymous', null, id => ({ taskId: id }), 'UNAUTHENTICATED'],
  ['missing completion permission', { userId: 'owner', permissions: ['task:create'] }, id => ({ taskId: id }), 'FORBIDDEN'],
  ['different owner with permission', { userId: 'other', permissions: ['task:complete'] }, id => ({ taskId: id }), 'NOT_FOUND'],
  ['missing task', owner, () => ({ taskId: 'missing' }), 'NOT_FOUND'],
  ['forged owner', owner, id => ({ taskId: id, ownerId: 'other' }), 'VALIDATION_ERROR'],
  ['empty ID', owner, () => ({ taskId: ' ' }), 'VALIDATION_ERROR'],
  ['non-string ID', owner, () => ({ taskId: 42 }), 'VALIDATION_ERROR'],
  ['oversized ID', owner, () => ({ taskId: 'x'.repeat(129) }), 'VALIDATION_ERROR'],
]) {
  test(`${name} cannot change task state`, async () => {
    const app = createDemoApp();
    const task = await app.execute(owner, { title: 'Report' });
    await assert.rejects(app.complete(context, makeInput(task.id)), { message: error });
    assert.deepEqual(app.repository.snapshot(), [task]);
  });
}
