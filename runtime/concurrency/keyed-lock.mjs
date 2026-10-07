export class KeyedLock {
  #tails = new Map();

  async run(key, fn) {
    if (!key) throw new Error('LOCK_KEY_REQUIRED');

    const previous = this.#tails.get(key) ?? Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    this.#tails.set(key, current);

    await previous.catch(() => {});

    try {
      return await fn();
    } finally {
      release();
      if (this.#tails.get(key) === current) this.#tails.delete(key);
    }
  }

  isLocked(key) {
    return this.#tails.has(key);
  }
}
