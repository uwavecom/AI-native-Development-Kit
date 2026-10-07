import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function assertSafeId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new Error('INVALID_STATE_ID');
  }
}

export class FileStateStore {
  constructor(root) {
    this.root = resolve(root);
  }

  async #ensure(path) {
    await mkdir(dirname(path), { recursive: true });
  }

  #approvalPath(id) {
    assertSafeId(id);
    return resolve(this.root, 'approvals', `${id}.json`);
  }

  #claimPath(id) {
    assertSafeId(id);
    return resolve(this.root, 'approval-claims', `${id}.claim`);
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

  async claimApproval(id, expectedSignature = null) {
    const approval = await this.getApproval(id);
    if (!approval || approval.consumed === true) return { claimed: false, reason: 'UNAVAILABLE' };
    if (expectedSignature && approval.actionSignature !== expectedSignature) {
      return { claimed: false, reason: 'SIGNATURE_MISMATCH' };
    }
    if (approval.oneShot !== true) return { claimed: true, approval };

    const path = this.#claimPath(id);
    await this.#ensure(path);
    try {
      await writeFile(path, JSON.stringify({
        id,
        actionSignature: approval.actionSignature,
        claimedAt: new Date().toISOString(),
      }) + '\n', { flag: 'wx' });
      return { claimed: true, approval };
    } catch (error) {
      if (error?.code === 'EEXIST') return { claimed: false, reason: 'ALREADY_CLAIMED' };
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
