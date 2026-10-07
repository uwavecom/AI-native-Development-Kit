import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

function run(stage, args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  const passed = !result.error && result.status === 0;
  console.log(JSON.stringify({ stage, status: passed ? 'PASS' : 'FAIL' }));
  if (!passed) process.exit(1);
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : path.endsWith('.mjs') ? [path] : [];
  });
}
for (const file of ['examples', 'guardrails', 'scripts', 'test'].flatMap(files)) run(`syntax:${file}`, ['--check', file]);
run('architecture', ['--experimental-vm-modules', 'guardrails/architecture.mjs']);
run('tool-contract', ['guardrails/tool-contract.mjs']);
run('behavior-and-guardrails', ['--experimental-vm-modules', '--test']);
