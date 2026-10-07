import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApp } from '../examples/reference-feature/composition/app.mjs';

const identity = { userId: 'user-1', permissions: ['task:create'] };

test('creates and persists a normalized task owned by trusted identity', async () => {
  const app = createDemoApp();
  const task = await app.execute(identity, { title: '  Report  ' });
  assert.equal(task.title, 'Report');
  assert.equal(task.ownerId, 'user-1');
  assert.ok(task.id);
  assert.deepEqual(app.repository.snapshot(), [task]);
  task.title = 'changed';
  assert.equal(app.repository.snapshot()[0].title, 'Report');
});

for (const [name, context, input, error] of [
  ['anonymous', null, { title: 'Report' }, 'UNAUTHENTICATED'],
  ['permission denied', { userId: 'user-1', permissions: [] }, { title: 'Report' }, 'FORBIDDEN'],
  ['forged owner', identity, { title: 'Report', ownerId: 'user-2' }, 'VALIDATION_ERROR'],
  ['invalid input', identity, { title: 42 }, 'VALIDATION_ERROR'],
  ['empty title', identity, { title: '   ' }, 'INVALID_TITLE'],
  ['oversized title', identity, { title: 'x'.repeat(121) }, 'INVALID_TITLE'],
]) {
  test(`${name} rejects without persisting`, async () => {
    const app = createDemoApp();
    await assert.rejects(app.execute(context, input), { message: error });
    assert.deepEqual(app.repository.snapshot(), []);
  });
}
