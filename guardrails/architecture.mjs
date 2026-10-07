import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { SourceTextModule } from 'node:vm';

export async function checkArchitecture(root) {
  const allowed = { domain: ['domain'], boundary: ['domain', 'boundary'], adapters: ['domain', 'adapters'], composition: ['domain', 'boundary', 'adapters', 'composition'] };
  const errors = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) { await walk(file); continue; }
      if (!file.endsWith('.mjs')) continue;
      const source = await readFile(file, 'utf8');
      const path = relative(root, file);
      const layer = path.split(sep)[0];
      const fail = message => errors.push({ code: 'ARCH001', file: path, message });
      if (!allowed[layer]) { fail('Use a declared reference layer.'); continue; }
      // Conservative lexical ban, including comments: this profile is intentionally small.
      if (/\bimport\s*\(|\brequire\s*\(/.test(source)) fail('Use static ES module imports; dynamic import and require are unsupported.');
      const module = new SourceTextModule(source, { identifier: file });
      for (const specifier of module.dependencySpecifiers) {
        if (specifier.startsWith('node:') && ['composition', 'adapters'].includes(layer)) continue;
        if (!specifier.startsWith('.')) { fail(`External import ${specifier} is not allowed in ${layer}.`); continue; }
        const target = relative(root, resolve(dirname(file), specifier));
        const targetLayer = target.split(sep)[0];
        if (!allowed[layer].includes(targetLayer)) fail(`${layer} cannot import ${specifier}; allowed: ${allowed[layer].join(', ')}.`);
      }
    }
  }
  await walk(root);
  return errors;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const errors = await checkArchitecture(resolve('examples/reference-feature'));
  for (const error of errors) console.error(JSON.stringify(error));
  process.exitCode = errors.length ? 1 : 0;
}
