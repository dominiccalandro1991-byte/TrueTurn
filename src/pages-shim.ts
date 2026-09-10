const KEY = Symbol.for("tanstack-start:start-storage-context");

class MemoryALS {
  store: unknown;
  run(store: unknown, fn: () => unknown) {
    const prev = this.store;
    this.store = store;
    try {
      return fn();
    } finally {
      this.store = prev;
    }
  }
  getStore() {
    return this.store;
  }
  enterWith(store: unknown) {
    this.store = store;
  }
}

const g = globalThis as unknown as { [k: symbol]: unknown };
if (!g[KEY]) g[KEY] = new MemoryALS();
