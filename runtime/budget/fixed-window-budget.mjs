export class FixedWindowBudget {
  #entries = new Map();

  constructor({ limit, windowMs, now = () => Date.now() }) {
    if (!Number.isInteger(limit) || limit <= 0) throw new Error('INVALID_BUDGET_LIMIT');
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error('INVALID_BUDGET_WINDOW');
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  inspect(key) {
    const now = this.now();
    const current = this.#entries.get(key);
    if (!current || now >= current.resetAt) {
      return { used: 0, remaining: this.limit, resetAt: now + this.windowMs };
    }
    return {
      used: current.used,
      remaining: Math.max(0, this.limit - current.used),
      resetAt: current.resetAt,
    };
  }

  consume(key, cost = 1) {
    if (!Number.isInteger(cost) || cost <= 0) throw new Error('INVALID_BUDGET_COST');
    const now = this.now();
    let current = this.#entries.get(key);
    if (!current || now >= current.resetAt) {
      current = { used: 0, resetAt: now + this.windowMs };
    }
    if (current.used + cost > this.limit) {
      this.#entries.set(key, current);
      return { allowed: false, ...this.inspect(key) };
    }
    current.used += cost;
    this.#entries.set(key, current);
    return { allowed: true, ...this.inspect(key) };
  }
}
