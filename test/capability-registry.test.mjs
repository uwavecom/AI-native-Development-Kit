import test from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry } from '../runtime/capabilities/capability-registry.mjs';

test('rejects duplicate providers without replacing the existing descriptor', () => {
  const registry = new CapabilityRegistry();
  registry.register('github', { tools: [{ name: 'read_file' }] });
  assert.throws(
    () => registry.register('github', { tools: [{ name: 'delete_file' }] }),
    { message: 'PROVIDER_ALREADY_REGISTERED' },
  );
  assert.deepEqual(registry.findTool('read_file').map(x => x.provider), ['github']);
  assert.deepEqual(registry.findTool('delete_file'), []);
});

test('rejects duplicates within a provider without leaving partial entries', () => {
  const registry = new CapabilityRegistry();
  assert.throws(
    () => registry.register('bad', { tools: [{ name: 'run' }, { name: 'run' }] }),
    { message: 'DUPLICATE_CAPABILITY_TOOL' },
  );
  assert.deepEqual(registry.listProviders(), []);
  registry.register('bad', { tools: [{ name: 'run' }] });
  assert.deepEqual(registry.listProviders(), ['bad']);
});

test('rejects malformed providers and tools atomically', () => {
  const registry = new CapabilityRegistry();
  for (const provider of ['', '   ', null, 42]) {
    assert.throws(() => registry.register(provider, { tools: [] }), { message: 'PROVIDER_REQUIRED' });
  }
  for (const tools of [[null], [{}], [{ name: '' }], [{ name: '  ' }], ['run'], [[1, 2]]]) {
    assert.throws(() => registry.register('invalid', { tools }), { message: 'INVALID_CAPABILITY_TOOL' });
  }
  assert.throws(() => registry.register('invalid', { tools: null }), { message: 'INVALID_CAPABILITY_DESCRIPTOR' });
  assert.deepEqual(registry.listProviders(), []);
});

test('uncloneable descriptors cannot change registry state', () => {
  const registry = new CapabilityRegistry();
  assert.throws(() => registry.register('invalid', { tools: [{ name: 'run', callback: () => {} }] }));
  assert.deepEqual(registry.listProviders(), []);
});

test('same tool name across providers remains supported', () => {
  const registry = new CapabilityRegistry();
  registry.register('github', { tools: [{ name: 'search', access: 'read' }] });
  registry.register('files', { tools: [{ name: 'search', access: 'read' }] });
  assert.deepEqual(registry.findTool('search').map(x => x.provider), ['github', 'files']);
});

test('input descriptors and returned tools cannot mutate registered snapshots', () => {
  const registry = new CapabilityRegistry();
  const descriptor = { tools: [{ name: 'read_file' }] };
  registry.register('github', descriptor);
  descriptor.tools[0].name = 'changed';
  registry.get('github').tools[0].name = 'changed_again';
  registry.findTool('read_file')[0].tool.name = 'changed_third';
  assert.equal(registry.findTool('read_file').length, 1);
  assert.equal(registry.findTool('changed').length, 0);
});
