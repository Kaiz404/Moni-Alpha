import '@azure/core-asynciterator-polyfill';

import { AbstractPowerSyncDatabase, PowerSyncDatabase } from "@powersync/react-native";
import { Kysely, wrapPowerSyncWithKysely } from '@powersync/kysely-driver';
import { SupabaseConnector } from "./SupabaseConnector";
import { AppSchema, Database } from "./AppSchema";
import { createContext, useContext } from "react";

export class SyncSystem {
  supabaseConnector: SupabaseConnector
  powersync: AbstractPowerSyncDatabase
  db: Kysely<Database>

  constructor() {
    this.supabaseConnector = new SupabaseConnector();
    this.powersync = new PowerSyncDatabase({
      schema: AppSchema,
      database: {
         dbFilename: 'app.sqlite'
      }
    });
    this.db = wrapPowerSyncWithKysely<Database>(this.powersync);
  }

  async init() {
    await this.powersync.init();
    await this.powersync.connect(this.supabaseConnector)
  }
}

export const syncSystem = new SyncSystem();
export const SyncSystemContext = createContext(syncSystem);
export const useSyncSystem = () => useContext(SyncSystemContext);