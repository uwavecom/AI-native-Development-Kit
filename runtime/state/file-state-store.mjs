import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export class FileStateStore {
  constructor(root) {
    this.root = resolve(root);
  }

  async #ensure(path) {
    await mkdir(dirname(path), { recursive: true });
  }

  #approvalPath(id) {
    return resolve(this.root, 'approvals', `${id}.json`);
  }

  #auditPath() {
    return resolve(this.root, 'audit.ndjson');
  }

  async putApproval(id, receipt) {
    const path = this.#approvalPath(id);
    await this.#ensure(path);
    await writeFile(path, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    return { id, path };
  }

  async getApproval(id) {
    try {
      return JSON.parse(await readFile(this.#approvalPath(id), 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async consumeApproval(id) {
    const current = await this.getApproval(id);
    if (!current) return null;
    if (current.consumed === true) return current;
    const next = { ...current, consumed: true, consumedAt: new Date().toISOString() };
    const path = this.#approvalPath(id);
    await writeFile(path, JSON.stringify(next, null, 2) + '\n');
    return next;
  }

  async appendAudit(event) {
    const path = this.#auditPath();
    await this.#ensure(path);
    const record = { ...event, recordedAt: event.recordedAt ?? new Date().toISOString() };
    await appendFile(path, JSON.stringify(record) + '\n');
    return record;
  }

  async readAudit() {
    try {
      const text = await readFile(this.#auditPath(), 'utf8');
      return text.split('\n').filter(Boolean).map(line => JSON.parse(line));
    } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
  }
}
