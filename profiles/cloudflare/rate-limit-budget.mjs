export class CloudflareRateLimitBudget {
  constructor(binding) {
    if (!binding?.limit) throw new Error('RATE_LIMIT_BINDING_REQUIRED');
    this.binding = binding;
  }

  async consume(key) {
    if (!key) throw new Error('BUDGET_KEY_REQUIRED');

    const result = await this.binding.limit({ key: String(key) });
    return {
      allowed: result.success === true,
      providerResult: result,
    };
  }
}
