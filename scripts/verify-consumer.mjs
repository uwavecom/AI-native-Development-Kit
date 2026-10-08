import { mkdtempSync, copyFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const temp = mkdtempSync(join(tmpdir(), 'ai-native-kit-consumer-'));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr}\n${result.stdout}`);
  }
  return result.stdout;
}
try {
  // Test the publishable artifact rather than internal relative imports.
  run('npm', ['pack', '--ignore-scripts', '--pack-destination', temp], resolve('.'));
  const tarball = readdirSync(temp).find(f => f.endsWith('.tgz'));
  if (!tarball) throw new Error('npm pack did not produce a tarball');
  writeFileSync(join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  copyFileSync(resolve('examples/consumer-first-action.mjs'), join(temp, 'first-action.mjs'));
  run('npm', ['install', '--ignore-scripts', '--offline', '--no-audit', '--no-fund', join(temp, tarball)], temp);
  const output = run(process.execPath, ['first-action.mjs'], temp);
  if (!output.includes('PASS: unapproved action blocked; approved action verified.')) {
    throw new Error('Expected consumer verification confirmation');
  }
  console.log(output.trim());
} finally {
  rmSync(temp, { recursive: true, force: true });
}
