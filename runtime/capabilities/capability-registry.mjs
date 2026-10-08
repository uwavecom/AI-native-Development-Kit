export class CapabilityRegistry {
  #providers = new Map();

  register(provider, descriptor) {
    if (typeof provider !== 'string' || !provider.trim()) throw new Error('PROVIDER_REQUIRED');
    if (this.#providers.has(provider)) throw new Error('PROVIDER_ALREADY_REGISTERED');
    if (!descriptor || !Array.isArray(descriptor.tools)) throw new Error('INVALID_CAPABILITY_DESCRIPTOR');

    const seen = new Set();
    for (const tool of descriptor.tools) {
      if (!tool || typeof tool !== 'object' || Array.isArray(tool) ||
          typeof tool.name !== 'string' || !tool.name.trim()) {
        throw new Error('INVALID_CAPABILITY_TOOL');
      }
      if (seen.has(tool.name)) throw new Error('DUPLICATE_CAPABILITY_TOOL');
      seen.add(tool.name);
    }

    // Clone before modifying the registry. Uncloneable descriptors must leave it unchanged.
    const snapshot = structuredClone(descriptor);
    this.#providers.set(provider, snapshot);
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
