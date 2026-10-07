export class CapabilityRegistry {
  #providers = new Map();

  register(provider, descriptor) {
    if (!provider) throw new Error('PROVIDER_REQUIRED');
    if (!descriptor || !Array.isArray(descriptor.tools)) throw new Error('INVALID_CAPABILITY_DESCRIPTOR');
    this.#providers.set(provider, structuredClone(descriptor));
  }

  get(provider) {
    const value = this.#providers.get(provider);
    return value ? structuredClone(value) : null;
  }

  listProviders() {
    return [...this.#providers.keys()].sort();
  }

  findTool(name) {
    const matches = [];
    for (const [provider, descriptor] of this.#providers) {
      for (const tool of descriptor.tools) {
        if (tool.name === name) matches.push({ provider, tool: structuredClone(tool) });
      }
    }
    return matches;
  }

  discover(predicate = () => true) {
    const results = [];
    for (const [provider, descriptor] of this.#providers) {
      for (const tool of descriptor.tools) {
        const entry = { provider, tool };
        if (predicate(entry)) results.push(structuredClone(entry));
      }
    }
    return results;
  }
}
