import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema";
import { BOOTSTRAP_SQL } from "./bootstrap";
import { customerDataDir } from "@/server/tenant";

export const dataDir = customerDataDir;

const globalForDb = globalThis as unknown as {
  __xtJournalDbs?: Map<string, ReturnType<typeof createDb>>;
};

const createDb = (dir: string) => {
  mkdirSync(dir, { recursive: true });
  const sqlite = new Database(join(dir, "journal.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(BOOTSTRAP_SQL);
  const folderColumns = sqlite.pragma("table_info(folders)") as { name: string }[];
  if (!folderColumns.some((column) => column.name === "deleted_at")) {
    sqlite.exec("ALTER TABLE folders ADD COLUMN deleted_at TEXT");
  }
  sqlite
    .transaction(() => {
      const columns = sqlite.pragma("table_info(accounts)") as { name: string }[];
      if (!columns.some((column) => column.name === "ibkr_sync_time_zone")) {
        sqlite.exec("ALTER TABLE accounts ADD COLUMN ibkr_sync_time_zone TEXT");
      }
    })
    .immediate();
  // Additive upgrade: existing executions retain their fields and dedup hashes.
  const executionColumns = sqlite.pragma("table_info(executions)") as { name: string }[];
  if (!executionColumns.some((column) => column.name === "import_metadata_json")) {
    sqlite.exec("ALTER TABLE executions ADD COLUMN import_metadata_json TEXT");
  }
  // Materialize CSV bounds once so connection and range lookups never scan candle JSON.
  const csvColumns = sqlite.pragma("table_info(market_csv_datasets)") as { name: string }[];
  sqlite.transaction(() => {
    for (const name of ["bar_count", "first_time", "last_time"]) {
      if (!csvColumns.some((column) => column.name === name))
        sqlite.exec(
          `ALTER TABLE market_csv_datasets ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0`,
        );
    }
    sqlite.exec(`UPDATE market_csv_datasets SET
      bar_count = json_array_length(bars_json),
      first_time = json_extract(bars_json, '$[0].time'),
      last_time = json_extract(bars_json, '$[#-1].time') WHERE bar_count = 0`);
  })();
  return drizzle(sqlite, { schema });
};

const databases = globalForDb.__xtJournalDbs ?? (globalForDb.__xtJournalDbs = new Map());
function requestDatabase() {
  const dir = dataDir();
  let database = databases.get(dir);
  if (!database) {
    database = createDb(dir);
    databases.set(dir, database);
  }
  return database;
}

// Resolve inside the authenticated request, never when the module is imported.
// The existing domain engine sees only this customer's database and attachments.
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, property) {
    const database = requestDatabase();
    const value = Reflect.get(database, property);
    return typeof value === "function" ? value.bind(database) : value;
  },
});

export * from "./schema";
