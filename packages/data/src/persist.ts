import { applyChanges, type Change } from '@legendapp/state';
import type { ObservablePersistPlugin, PersistMetadata } from '@legendapp/state/sync';

/** Small facts the store keeps beside its tables, such as which gated migrations it has seen. MMKV fits it as is. */
export type FlagStore = {
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: boolean): void;
  clearAll(): void;
};

/** Where the store keeps rows between launches: MMKV on the phone, memory (IndexedDB later) on the web. */
export type MoniPersist = {
  plugin: ObservablePersistPlugin;
  flags: FlagStore;
};

class MemoryPersistPlugin implements ObservablePersistPlugin {
  private tables = new Map<string, unknown>();
  private metadata = new Map<string, PersistMetadata>();

  getTable<T>(table: string, init: object): T {
    return (this.tables.get(table) ?? init) as T;
  }
  set(table: string, changes: Change[]): void {
    this.tables.set(table, applyChanges((this.tables.get(table) as object) ?? {}, changes));
  }
  deleteTable(table: string): void {
    this.tables.delete(table);
  }
  getMetadata(table: string): PersistMetadata {
    return this.metadata.get(table) ?? {};
  }
  setMetadata(table: string, metadata: PersistMetadata): void {
    this.metadata.set(table, metadata);
  }
  deleteMetadata(table: string): void {
    this.metadata.delete(table);
  }
}

/** Keeps everything for the life of the page or process: a reload pulls the whole ledger again. */
export function memoryPersist(): MoniPersist {
  const flags = new Map<string, boolean>();
  return {
    plugin: new MemoryPersistPlugin(),
    flags: {
      getBoolean: (key) => flags.get(key),
      set: (key, value) => void flags.set(key, value),
      clearAll: () => flags.clear(),
    },
  };
}
