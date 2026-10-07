export class FakeGitHubProvider {
  constructor() {
    this.files = new Map([['README.md', { content: 'hello', sha: 'sha-1' }]]);
    this.branches = new Set(['main']);
    this.pullRequests = new Map();
    this.nextPr = 1;
    this.failures = new Map();
  }

  inject(operation, mode) {
    this.failures.set(operation, mode);
  }

  #take(operation) {
    const mode = this.failures.get(operation);
    this.failures.delete(operation);
    if (!mode) return;
    if (mode === 'timeout_after_dispatch') {
      const error = new Error('timeout');
      error.code = 'TIMEOUT_AFTER_DISPATCH';
      throw error;
    }
    const error = new Error(mode);
    error.code = mode;
    throw error;
  }

  async fetchFile(path) {
    const file = this.files.get(path);
    if (!file) {
      const error = new Error('not found');
      error.code = 'NOT_FOUND';
      throw error;
    }
    return structuredClone(file);
  }

  async createBranch(name) {
    this.branches.add(name);
    this.#take('create_branch');
    return { branch: name };
  }

  async updateFile(path, content) {
    const sha = `sha-${this.files.size + content.length}`;
    this.files.set(path, { content, sha });
    this.#take('update_file');
    return { path, sha };
  }

  async createPullRequest({ head, base, title }) {
    const number = this.nextPr++;
    this.pullRequests.set(number, { number, head, base, title, merged: false });
    this.#take('create_pull_request');
    return structuredClone(this.pullRequests.get(number));
  }

  async mergePullRequest(number) {
    const pr = this.pullRequests.get(number);
    if (!pr) {
      const error = new Error('not found');
      error.code = 'NOT_FOUND';
      throw error;
    }
    pr.merged = true;
    this.#take('merge_pull_request');
    return structuredClone(pr);
  }
}

export class FakeTradingViewProvider {
  constructor() {
    this.alerts = new Map();
    this.nextAlert = 1;
    this.failures = new Map();
  }

  inject(operation, mode) {
    this.failures.set(operation, mode);
  }

  #take(operation) {
    const mode = this.failures.get(operation);
    this.failures.delete(operation);
    if (!mode) return;
    if (mode === 'timeout_after_dispatch') {
      const error = new Error('timeout');
      error.code = 'TIMEOUT_AFTER_DISPATCH';
      throw error;
    }
    const error = new Error(mode);
    error.code = mode;
    throw error;
  }

  async searchSymbols(query) {
    return [{ symbol: 'NASDAQ:NVDA', query }];
  }

  async runScreener() {
    return [{ symbol: 'NASDAQ:NVDA', score: 0.91 }];
  }

  async createAlert({ symbol, threshold, condition }) {
    const id = `alert-${this.nextAlert++}`;
    const alert = { id, symbol, threshold, condition };
    this.alerts.set(id, alert);
    this.#take('create_alert');
    return structuredClone(alert);
  }

  findAlert({ symbol, threshold, condition }) {
    return [...this.alerts.values()].find(
      alert => alert.symbol === symbol &&
        alert.threshold === threshold &&
        alert.condition === condition
    ) ?? null;
  }
}
