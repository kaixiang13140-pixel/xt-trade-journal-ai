import { cookies } from "next/headers";
import { bad, handler, ok } from "@/server/api";
import { authLimit, customerBody, CUSTOMER_COOKIE, customerForToken } from "@/server/customers";
import { currentCustomer, customerMode } from "@/server/tenant";
import { captureSnapshot, MAX_SNAPSHOT_BYTES, SnapshotError } from "@/server/cloud-backup-snapshot";

/** Local, opt-in selected-field snapshot. No restore, linking or automatic sync. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cloudSettings() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !key || !/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key)) return null;
  try {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "https:" ||
      !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return { url, key };
  } catch {
    return null;
  }
}

/** Provider bodies are untrusted and are never included in an error response. */
async function boundedJson(response: Response, maximum = 16_384): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error("Oversized response");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
const validUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const tokenString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 8192 && !/[\s\r\n]/.test(value);

export const POST = handler(async (request: Request) => {
  const hostname = new URL(request.url).hostname;
  if (
    process.env.NODE_ENV !== "development" ||
    !customerMode() ||
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)
  )
    return bad("Local test only.", 404);
  // handler() verifies the local cookie, rejects cross-site POSTs and creates tenant context.
  const localUser = customerForToken((await cookies()).get(CUSTOMER_COOKIE)?.value);
  if (!localUser || currentCustomer() !== localUser.id) return bad("Sign in to XT first.", 401);
  const cfg = cloudSettings();
  if (!cfg) return bad("Configure Supabase URL and publishable key.", 503);
  const body = await customerBody(request);
  if (body.confirmBackup !== true) return bad("Confirm your backup explicitly.");
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body.password;
  // Matching email is a destination restriction, NOT an automatic identity merge.
  if (email !== localUser.email.trim().toLowerCase())
    return bad("The Supabase and XT account emails must match.", 403);
  if (typeof password !== "string" || password.length < 1 || password.length > 128)
    return bad("Enter your Supabase password (1–128 characters).");
  authLimit("cloud-backup:" + localUser.id, 6, 600);
  let record: ReturnType<typeof captureSnapshot>;
  try {
    record = captureSnapshot();
  } catch (error) {
    if (error instanceof SnapshotError) return bad(error.message, error.status);
    return bad("Unable to capture the local snapshot.", 500);
  }

  let token: string | undefined;
  try {
    let auth: Record<string, unknown> | null;
    try {
      const response = await fetch(new URL("/auth/v1/token?grant_type=password", cfg.url), {
        method: "POST",
        headers: { apikey: cfg.key, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok)
        return bad(
          response.status === 429
            ? "Too many Supabase login attempts. Try again later."
            : "Supabase sign-in failed. Verify email and password.",
          response.status === 429 ? 429 : 401,
        );
      auth = object(await boundedJson(response));
      if (tokenString(auth?.access_token)) token = auth.access_token;
      const claimed = object(auth?.user);
      if (
        !token ||
        !validUuid(claimed?.id) ||
        typeof claimed.email !== "string" ||
        claimed.email.trim().toLowerCase() !== email
      )
        return bad("Supabase account identity could not be verified.", 401);
      const verified = await fetch(new URL("/auth/v1/user", cfg.url), {
        headers: { apikey: cfg.key, Authorization: "Bearer " + token },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12_000),
      });
      if (!verified.ok) return bad("Supabase account identity could not be verified.", 401);
      const user = object(await boundedJson(verified));
      if (
        !validUuid(user?.id) ||
        user.id !== claimed.id ||
        typeof user.email !== "string" ||
        user.email.trim().toLowerCase() !== email
      )
        return bad("Supabase account identity could not be verified.", 401);
      record.user_id = user.id;
    } catch {
      return bad("Unable to connect to Supabase Auth.", 502);
    }

    const serialized = JSON.stringify(record);
    if (Buffer.byteLength(serialized, "utf8") > MAX_SNAPSHOT_BYTES)
      return bad("Snapshot exceeds the 850 KB pilot limit.", 413);
    try {
      const url = new URL("/rest/v1/xt_cloud_backups", cfg.url);
      url.searchParams.set("on_conflict", "user_id");
      // Never echo the uploaded trades/notes back through the API.
      url.searchParams.set(
        "select",
        "user_id,format_version,captured_at,account_count,execution_count,trade_count",
      );
      const response = await fetch(url, {
        method: "POST",
        headers: {
          apikey: cfg.key,
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: serialized,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return bad("Cloud write failed. Check table permissions and RLS.", 502);
      const rows = await boundedJson(response);
      const row = Array.isArray(rows) && rows.length === 1 ? object(rows[0]) : null;
      if (
        !row ||
        row.user_id !== record.user_id ||
        row.format_version !== 1 ||
        typeof row.captured_at !== "string" ||
        Date.parse(row.captured_at) !== Date.parse(record.captured_at) ||
        row.account_count !== record.account_count ||
        row.execution_count !== record.execution_count ||
        row.trade_count !== record.trade_count
      )
        return bad(
          "Cloud record confirmation failed. Check the Supabase table before retrying.",
          502,
        );
      return ok({
        status: "uploaded",
        capturedAt: record.captured_at,
        counts: {
          accounts: record.account_count,
          executions: record.execution_count,
          trades: record.trade_count,
          notes: record.payload.notes.length,
        },
        warning: "Pilot snapshot only. Not an automatic sync or full restorable backup.",
      });
    } catch {
      return bad("Cloud request failed. Check the table before retrying.", 502);
    }
  } finally {
    // Revoke only the temporary password-grant session, never all of the user's sessions.
    if (token)
      await fetch(new URL("/auth/v1/logout?scope=local", cfg.url), {
        method: "POST",
        headers: { apikey: cfg.key, Authorization: "Bearer " + token },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      }).catch(() => {});
  }
});
