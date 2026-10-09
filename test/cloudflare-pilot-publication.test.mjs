import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../examples/cloudflare-agent-pilot/', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const json = name => JSON.parse(read(name));

test('pilot dependencies are locked and package manifest matches lockfile', () => {
  const manifest = json('package.json');
  const lock = json('package-lock.json');
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(manifest.name, lock.name);
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
  for (const name of Object.keys(manifest.devDependencies)) {
    assert.ok(lock.packages[`node_modules/${name}`]?.version,
      `Missing resolved package: ${name}`);
    assert.ok(lock.packages[`node_modules/${name}`]?.integrity,
      `Missing integrity digest: ${name}`);
  }
});

test('CI installs locked dependencies without running npm package scripts', () => {
  const workflow = readFileSync(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8');
  assert.match(workflow, /npm ci --ignore-scripts --no-audit --no-fund/);
  assert.doesNotMatch(workflow, /npm install --no-save --no-package-lock/);
  assert.equal(existsSync(new URL('../.github/workflows/bootstrap-cloudflare-lock.yml', import.meta.url)), false);
});

test('deployable Wrangler file has no plaintext pilot or GitHub tokens', () => {
  const wrangler = json('wrangler.jsonc');
  assert.equal(wrangler.vars?.PILOT_SIGNING_SECRET, undefined);
  assert.equal(wrangler.vars?.PILOT_CALLER_TOKEN, undefined);
  assert.equal(wrangler.vars?.PILOT_REVOKER_TOKEN, undefined);
  assert.equal(wrangler.vars?.GITHUB_ISSUES_TOKEN, undefined);
  assert.ok(wrangler.durable_objects.bindings.some(x => x.name === 'ApprovalCoordinator'));
});

test('pilot denies unauthenticated write requests at the HTTP boundary', () => {
  const source = read('agent.ts');
  assert.match(source, /request\.method !== 'GET'/);
  assert.doesNotMatch(source, /\bonRequest\([^)]*\)[\s\S]*?request\.json\(/);
});
