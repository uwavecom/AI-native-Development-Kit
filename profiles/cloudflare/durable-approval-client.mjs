export class DurableApprovalClient {
  constructor(namespace) {
    if (!namespace?.getByName) throw new Error('DURABLE_OBJECT_NAMESPACE_REQUIRED');
    this.namespace = namespace;
  }

  #stub(scopeKey) {
    if (!scopeKey) throw new Error('APPROVAL_SCOPE_KEY_REQUIRED');
    return this.namespace.getByName(String(scopeKey));
  }

  async put(scopeKey, approvalId, receipt) {
    return this.#stub(scopeKey).putApproval(approvalId, receipt);
  }

  async get(scopeKey, approvalId) {
    return this.#stub(scopeKey).getApproval(approvalId);
  }

  async claim(scopeKey, approvalId, expectedSignature) {
    return this.#stub(scopeKey).claimApproval(approvalId, expectedSignature);
  }

  async consume(scopeKey, approvalId) {
    return this.#stub(scopeKey).consumeApproval(approvalId);
  }
}
