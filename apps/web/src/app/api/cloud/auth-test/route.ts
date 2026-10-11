import { handler, bad, ok } from "@/server/api";
import { authLimit, customerBody } from "@/server/customers";
import { customerMode } from "@/server/tenant";

// Local-only proof of concept. This does not change XT customer sessions,
// passwords, or SQLite records. It does not persist Supabase tokens.
export const runtime = "nodejs";

type AuthReply = {
  access_token?: string;
  user?: { id?: string };
};
type Profile = { id: string; display_name: string | null };

function config() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !key) return null;
  try {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.hostname.endsWith(".supabase.co")
    ) return null;
    return { url, key };
  } catch {
    return null;
  }
}

export const POST = handler(async (request: Request) => {
  if (process.env.NODE_ENV !== "development" || !customerMode())
    return bad("Cloud auth test is available only in local customer development mode.", 404);

  const cfg = config();
  if (!cfg) return bad("Supabase connection is not configured.", 503);
  authLimit("cloud-test-global", 30, 600);

  const body = await customerBody(request);
  const operation = body.action;
  if (operation !== "signup" && operation !== "signin")
    return bad("Choose signup or signin.");

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return bad("Enter a valid email.");
  if (typeof password !== "string" || password.length < 12 || password.length > 128)
    return bad("Use a password with 12 to 128 characters.");

  authLimit("cloud-test-email:" + email, 10, 600);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";

  const authUrl = new URL(
    operation === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password",
    cfg.url,
  );
  try {
    const authResponse = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.key },
      body: JSON.stringify(
        operation === "signup"
          ? { email, password, data: { display_name: name } }
          : { email, password },
      ),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!authResponse.ok) {
      if (authResponse.status === 429)
        return bad("Supabase rate limit reached. Try again later.", 429);
      if (operation === "signin" && (authResponse.status === 400 || authResponse.status === 401))
        return bad("Sign-in failed. Check your password and email verification.", 401);
      return bad("Supabase rejected the request. Check the project Auth settings.", 502);
    }
    const auth = (await authResponse.json()) as AuthReply;
    if (operation === "signup") {
      // With email confirmation enabled, a session is usually not returned.
      // Avoid disclosing whether an email was already registered.
      return ok({ status: "check_email", message: "Check your email for a Supabase confirmation link if one was sent." });
    }

    if (!auth.access_token || !auth.user?.id)
      return bad("No verified session returned. Confirm your email and retry.", 401);

    // RLS verification: query the same row using this user's access token.
    const profileUrl = new URL("/rest/v1/xt_profiles", cfg.url);
    profileUrl.searchParams.set("select", "id,display_name");
    profileUrl.searchParams.set("id", "eq." + auth.user.id);
    const profileResponse = await fetch(profileUrl, {
      headers: { apikey: cfg.key, Authorization: "Bearer " + auth.access_token },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!profileResponse.ok)
      return bad("Supabase sign-in succeeded but the profile query failed. Check RLS and grants.", 502);

    const rows = (await profileResponse.json()) as Profile[];
    return ok({
      status: "authenticated",
      authenticated: true,
      profileFound: Array.isArray(rows) && rows.some((row) => row.id === auth.user?.id),
    });
  } catch {
    return bad("Unable to reach Supabase. Check the project URL and network.", 502);
  }
});
