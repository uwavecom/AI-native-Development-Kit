import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkArchitecture } from '../guardrails/architecture.mjs';

test('guard rejects forbidden imports, re-exports, and dynamic imports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kit-arch-'));
  try {
    await mkdir(join(root, 'domain'));
    await writeFile(join(root, 'domain', 'bad.mjs'), "export { x } from '../adapters/db.mjs';\nimport('node:fs');\n");
    const errors = await checkArchitecture(root);
    assert.equal(errors.length, 2);
    assert.ok(errors.every(error => error.code === 'ARCH001'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('guard accepts inward dependency', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kit-arch-'));
  try {
    await mkdir(join(root, 'adapters'));
    await writeFile(join(root, 'adapters', 'good.mjs'), "import { x } from '../domain/model.mjs';\n");
    assert.deepEqual(await checkArchitecture(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
