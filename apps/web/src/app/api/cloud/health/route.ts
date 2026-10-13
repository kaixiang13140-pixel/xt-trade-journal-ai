import { NextResponse } from "next/server";

// Opt-in connectivity check only. This does not replace XT's existing
// customer authentication or SQLite storage.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noCache = { "Cache-Control": "no-store" };

function result(connected: boolean, status: string, httpStatus: number) {
  return NextResponse.json(
    { connected, status, authService: connected ? "reachable" : "unavailable" },
    { status: httpStatus, headers: noCache },
  );
}

export async function GET() {
  const projectUrl = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!projectUrl || !publishableKey) return result(false, "not_configured", 503);

  let healthUrl: URL;
  try {
    const origin = new URL(projectUrl);
    if (origin.protocol !== "https:" || origin.username || origin.password) {
      return result(false, "invalid_project_url", 503);
    }
    healthUrl = new URL("/auth/v1/health", origin);
  } catch {
    return result(false, "invalid_project_url", 503);
  }

  try {
    const response = await fetch(healthUrl, {
      headers: { apikey: publishableKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok
      ? result(true, "connected", 200)
      : result(false, "auth_service_unavailable", 502);
  } catch {
    // Do not return upstream response bodies, URLs, or key material to callers.
    return result(false, "connection_failed", 502);
  }
}
