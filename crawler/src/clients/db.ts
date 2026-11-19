import "dotenv/config";
import type { DbAdapter } from "./db-adapter";
import { PocketBaseAdapter } from "./pocketbase-adapter";
import { SqliteAdapter } from "./sqlite-adapter";

let adapterInstance: DbAdapter | null = null;

export function getAdapter(): DbAdapter {
  if (!adapterInstance) {
    const dbType = (process.env.DB_TYPE || "pocketbase").toLowerCase();
    adapterInstance =
      dbType === "sqlite" ? new SqliteAdapter() : new PocketBaseAdapter();
  }
  return adapterInstance;
}

export function setAdapter(adapter: DbAdapter | null): void {
  adapterInstance = adapter;
}
