import { cookies } from "next/headers";
import { db, accounts, executions, trades, journalDays, notes, folders, playbooks } from "@/db";
import { bad, handler, ok } from "@/server/api";
import { authLimit, customerBody, CUSTOMER_COOKIE, customerForToken } from "@/server/customers";
import { customerMode } from "@/server/tenant";

/**
 * Local development pilot. Explicit, manual copy of selected SQLite data into
 * one user-owned Supabase snapshot. No restore or automatic synchronization.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AuthReply {
  access_token?: string;
  user?: { id?: string; email?: string };
}

function cloudSettings() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !key || !key.startsWith("sb_publishable_")) return null;
  try {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".supabase.co") ||
      url.port || url.username || url.password
    ) return null;
    return { url, key };
  } catch {
    return null;
  }
}

export const POST = handler(async (request: Request) => {
  const hostname = new URL(request.url).hostname;
  if (
    process.env.NODE_ENV !== "development" ||
    !customerMode() ||
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)
  ) return bad("Local test only.", 404);

  // The handler has already verified the XT customer cookie and scoped the
  // SQLite database to the active XT customer.
  const localToken = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  const localUser = customerForToken(localToken);
  if (!localUser) return bad("Sign in to XT first.", 401);

  const cfg = cloudSettings();
  if (!cfg) return bad("Configure Supabase URL and publishable key.", 503);

  const body = await customerBody(request);
  if (body.confirmBackup !== true) return bad("Confirm your backup explicitly.");

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body.password;
  // Do not allow a local customer's trades to be copied to a different email.
  if (email !== localUser.email.trim().toLowerCase())
    return bad("The Supabase and XT account emails must match.", 403);
  if (typeof password !== "string" || password.length < 12 || password.length > 128)
    return bad("Enter your Supabase password (12–128 characters).");

  authLimit("cloud-backup:" + localUser.id, 6, 600);

  let token: string;
  let cloudUserId: string;
  try {
    const url = new URL("/auth/v1/token?grant_type=password", cfg.url);
    const res = await fetch(url, {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok)
      return bad(
        res.status === 429
          ? "Too many Supabase login attempts. Try again later."
          : "Supabase sign-in failed. Verify email and password.",
        res.status === 429 ? 429 : 401,
      );
    const auth = (await res.json()) as AuthReply;
    if (!auth.access_token || !auth.user?.id || auth.user.email?.toLowerCase() !== email)
      return bad("Supabase account identity could not be verified.", 401);
    token = auth.access_token;
    cloudUserId = auth.user.id;
  } catch {
    return bad("Unable to connect to Supabase Auth.", 502);
  }

  // Explicit field whitelists: never send broker credentials, AI keys,
  // customer passwords, sessions, encrypted settings, or attachment binaries.
  const accountRows = db.select({
    id: accounts.id,
    name: accounts.name,
    broker: accounts.broker,
    kind: accounts.kind,
    currency: accounts.currency,
    initialBalance: accounts.initialBalance,
    profitCalcMethod: accounts.profitCalcMethod,
    createdAt: accounts.createdAt,
    archivedAt: accounts.archivedAt,
  }).from(accounts).all();

  const executionRows = db.select({
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
  }).from(executions).all();

  const tradeRows = db.select().from(trades).all();
  const dayRows = db.select().from(journalDays).all();
  const noteRows = db.select().from(notes).all();
  const folderRows = db.select().from(folders).all();
  const playbookRows = db.select().from(playbooks).all();

  if (!accountRows.length && !executionRows.length && !tradeRows.length)
    return bad("No local trading data found. Add test trades before uploading.");

  const capturedAt = new Date().toISOString();
  const payload = {
    format: "xt-cloud-snapshot-v1",
    capturedAt,
    accounts: accountRows,
    executions: executionRows,
    trades: tradeRows,
    journalDays: dayRows,
    notes: noteRows,
    folders: folderRows,
    playbooks: playbookRows,
  };
  const record = {
    user_id: cloudUserId,
    format_version: 1,
    captured_at: capturedAt,
    account_count: accountRows.length,
    execution_count: executionRows.length,
    trade_count: tradeRows.length,
    payload,
  };
  const serialized = JSON.stringify(record);
  if (Buffer.byteLength(serialized, "utf8") > 850_000)
    return bad("Snapshot exceeds the 850 KB pilot limit.", 413);

  try {
    const url = new URL("/rest/v1/xt_cloud_backups", cfg.url);
    url.searchParams.set("on_conflict", "user_id");
    const result = await fetch(url, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: serialized,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!result.ok) return bad("Cloud write failed. Check table permissions and RLS.", 502);

    const rows = (await result.json()) as Array<{
      user_id?: string;
      account_count?: number;
      execution_count?: number;
      trade_count?: number;
      captured_at?: string;
    }>;
    const row = Array.isArray(rows)
      ? rows.find((item) => item.user_id === cloudUserId)
      : undefined;
    if (
      !row ||
      row.account_count !== accountRows.length ||
      row.execution_count !== executionRows.length ||
      row.trade_count !== tradeRows.length
    ) return bad("Cloud record confirmation failed. Check the Supabase table.", 502);

    return ok({
      status: "uploaded",
      capturedAt: row.captured_at,
      counts: {
        accounts: accountRows.length,
        executions: executionRows.length,
        trades: tradeRows.length,
        notes: noteRows.length,
      },
      warning: "Pilot snapshot only. Not an automatic sync or full restorable backup.",
    });
  } catch {
    return bad("Cloud request failed. Check the table before retrying.", 502);
  }
});
