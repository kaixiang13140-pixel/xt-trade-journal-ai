import { sql, type AnyColumn } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { db, accounts, executions, trades, journalDays, notes, folders, playbooks } from "@/db";

export const MAX_SNAPSHOT_BYTES = 850_000;
export class SnapshotError extends Error {
  constructor(
    message: string,
    public status = 413,
  ) {
    super(message);
  }
}
// Explicit, reviewable field lists: schema additions are NOT automatically exported.
const TABLES = {
  accounts: {
    table: accounts,
    fields: {
      id: accounts.id,
      name: accounts.name,
      broker: accounts.broker,
      kind: accounts.kind,
      currency: accounts.currency,
      initialBalance: accounts.initialBalance,
      profitCalcMethod: accounts.profitCalcMethod,
      createdAt: accounts.createdAt,
      archivedAt: accounts.archivedAt,
    },
  },
  executions: {
    table: executions,
    fields: {
      id: executions.id,
      accountId: executions.accountId,
      symbol: executions.symbol,
      side: executions.side,
      quantity: executions.quantity,
      price: executions.price,
      fee: executions.fee,
      executedAt: executions.executedAt,
      assetClass: executions.assetClass,
      source: executions.source,
      contentHash: executions.contentHash,
      createdAt: executions.createdAt,
    },
  },
  trades: {
    table: trades,
    fields: {
      key: trades.key,
      accountId: trades.accountId,
      symbol: trades.symbol,
      assetClass: trades.assetClass,
      direction: trades.direction,
      status: trades.status,
      openedAt: trades.openedAt,
      closedAt: trades.closedAt,
      quantity: trades.quantity,
      openQuantity: trades.openQuantity,
      avgEntry: trades.avgEntry,
      avgExit: trades.avgExit,
      grossPnl: trades.grossPnl,
      fees: trades.fees,
      netPnl: trades.netPnl,
      executionCount: trades.executionCount,
      executionIdsJson: trades.executionIdsJson,
      exitsJson: trades.exitsJson,
      durationMs: trades.durationMs,
      notes: trades.notes,
      tagsJson: trades.tagsJson,
      mistakesJson: trades.mistakesJson,
      playbookId: trades.playbookId,
      rating: trades.rating,
      stopLoss: trades.stopLoss,
      profitTarget: trades.profitTarget,
      reviewedAt: trades.reviewedAt,
    },
  },
  journalDays: {
    table: journalDays,
    fields: {
      date: journalDays.date,
      note: journalDays.note,
      updatedAt: journalDays.updatedAt,
    },
  },
  notes: {
    table: notes,
    fields: {
      id: notes.id,
      folderId: notes.folderId,
      title: notes.title,
      content: notes.content,
      tagsJson: notes.tagsJson,
      tradeKey: notes.tradeKey,
      dayDate: notes.dayDate,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    },
  },
  folders: {
    table: folders,
    fields: {
      id: folders.id,
      name: folders.name,
      kind: folders.kind,
      createdAt: folders.createdAt,
      deletedAt: folders.deletedAt,
    },
  },
  playbooks: {
    table: playbooks,
    fields: {
      id: playbooks.id,
      name: playbooks.name,
      description: playbooks.description,
      rulesJson: playbooks.rulesJson,
      createdAt: playbooks.createdAt,
    },
  },
};

type Rows = Record<keyof typeof TABLES, Record<string, unknown>[]>;

/** One SQLite read transaction; no local records or keys are written. */
export function captureSnapshot() {
  return db.transaction(() => {
    const rows: Rows = {
      accounts: [],
      executions: [],
      trades: [],
      journalDays: [],
      notes: [],
      folders: [],
      playbooks: [],
    };
    const counts = {} as Record<keyof Rows, number>;
    for (const [name, { table }] of Object.entries(TABLES)) {
      counts[name as keyof Rows] = db
        .select({ n: sql<number>`count(*)` })
        .from(table)
        .get()!.n;
    }
    if (!counts.accounts && !counts.executions && !counts.trades)
      throw new SnapshotError(
        "No local trading data found. Add test trades before uploading.",
        400,
      );
    const capturedAt = new Date().toISOString();
    const payload = { format: "xt-cloud-snapshot-v1", capturedAt, ...rows };
    const record = {
      user_id: "00000000-0000-0000-0000-000000000000",
      format_version: 1,
      captured_at: capturedAt,
      account_count: counts.accounts,
      execution_count: counts.executions,
      trade_count: counts.trades,
      payload,
    };
    // UUID has constant length. Count the exact JSON envelope, then each row and comma.
    let bytes = Buffer.byteLength(JSON.stringify(record), "utf8");
    for (const [name, { table, fields }] of Object.entries(TABLES)) {
      const columns = Object.values(fields) as AnyColumn[];
      // Reject enormous strings before transferring them from SQLite to JS.
      const lengths = columns.map((column) => sql`coalesce(length(cast(${column} as blob)), 0)`);
      const minimum = db
        .select({ bytes: sql<number>`coalesce(sum(${sql.join(lengths, sql` + `)}),0)` })
        .from(table)
        .get()!.bytes;
      if (minimum > MAX_SNAPSHOT_BYTES - bytes)
        throw new SnapshotError("Snapshot exceeds the 850 KB pilot limit.");
      const statement = db
        .select(fields)
        .from(table as SQLiteTable)
        .toSQL();
      const keys = Object.keys(fields);
      const destination = rows[name as keyof Rows];
      const iterator = db.$client
        .prepare(statement.sql)
        .raw()
        .iterate(...statement.params);
      for (const values of iterator) {
        const row = Object.fromEntries(
          keys.map((key, index) => [key, (values as unknown[])[index]]),
        );
        bytes += Buffer.byteLength(JSON.stringify(row), "utf8") + (destination.length ? 1 : 0);
        if (bytes > MAX_SNAPSHOT_BYTES)
          throw new SnapshotError("Snapshot exceeds the 850 KB pilot limit.");
        destination.push(row);
      }
    }
    return record;
  });
}
