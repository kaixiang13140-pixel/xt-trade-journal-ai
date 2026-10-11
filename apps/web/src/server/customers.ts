import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { baseDataDir, customerMode } from "./tenant";

export const CUSTOMER_COOKIE = "xt_customer_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
export const customerCookieOptions = (url: string) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" || new URL(url).protocol === "https:",
  path: "/",
  maxAge: SESSION_SECONDS,
});
type User = { id: string; email: string; name: string };
type StoredUser = User & { password_hash: string; salt: string };
const scryptAsync = promisify(scrypt);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const shared = globalThis as typeof globalThis & {
  __xtRegistries?: Map<string, Database.Database>;
};
const registries = shared.__xtRegistries ?? (shared.__xtRegistries = new Map());

function registry() {
  if (!customerMode()) throw new Error("Customer accounts are disabled");
  const dir = baseDataDir();
  let database = registries.get(dir);
  if (!database) {
    mkdirSync(dir, { recursive: true });
    database = new Database(join(dir, "xt-users.sqlite"));
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
    database.pragma("busy_timeout = 5000");
    database.exec(`
      CREATE TABLE IF NOT EXISTS xt_users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS xt_sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES xt_users(id),
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS xt_sessions_expiry ON xt_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS xt_auth_limits (
        scope TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
      );
    `);
    registries.set(dir, database);
  }
  return database;
}

export class CustomerError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function validEmail(input: unknown): string {
  if (typeof input !== "string" || input.length > 254)
    throw new CustomerError("Enter a valid email address.");
  const email = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new CustomerError("Enter a valid email address.");
  return email;
}

export function authLimit(scope: string, maximum: number, seconds = 900) {
  const database = registry();
  const now = Date.now();
  database
    .transaction(() => {
      database.prepare("DELETE FROM xt_auth_limits WHERE expires_at <= ?").run(now);
      const key = digest(scope);
      const row = database.prepare("SELECT count FROM xt_auth_limits WHERE scope = ?").get(key) as
        { count: number } | undefined;
      if (row && row.count >= maximum)
        throw new CustomerError("Too many attempts. Please try again later.", 429);
      database
        .prepare(
          `INSERT INTO xt_auth_limits (scope,count,expires_at) VALUES (?,1,?)
        ON CONFLICT(scope) DO UPDATE SET count = count + 1`,
        )
        .run(key, now + seconds * 1000);
    })
    .immediate();
}

export function verifyRegistrationCode(input: unknown) {
  const expected = process.env.XT_REGISTRATION_CODE;
  if (!expected) return;
  const candidate = typeof input === "string" ? input : "";
  const left = Buffer.from(digest(candidate));
  const right = Buffer.from(digest(expected));
  if (!timingSafeEqual(left, right)) throw new CustomerError("Invalid invitation code.", 403);
}

export async function registerCustomer(input: {
  email?: unknown;
  name?: unknown;
  password?: unknown;
}) {
  const email = validEmail(input.email);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 80) throw new CustomerError("Enter a name up to 80 characters.");
  if (
    typeof input.password !== "string" ||
    input.password.length < 12 ||
    input.password.length > 128
  )
    throw new CustomerError("Use a password with 12 to 128 characters.");
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(input.password, salt, 64)) as Buffer;
  const user = { id: randomUUID(), email, name };
  try {
    registry()
      .prepare(
        "INSERT INTO xt_users (id,email,name,password_hash,salt,created_at) VALUES (?,?,?,?,?,?)",
      )
      .run(user.id, email, name, hash.toString("hex"), salt, Date.now());
  } catch (error) {
    if ((error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE")
      throw new CustomerError("This email cannot be registered. Try signing in.", 409);
    throw error;
  }
  return user;
}

export async function loginCustomer(emailInput: unknown, password: unknown) {
  const email = validEmail(emailInput);
  if (typeof password !== "string" || password.length > 128)
    throw new CustomerError("Incorrect email or password.", 401);
  authLimit(`login:${email}`, 10);
  const user = registry().prepare("SELECT * FROM xt_users WHERE email = ?").get(email) as
    StoredUser | undefined;
  // Unknown email takes the same password-hashing work; no fast enumeration path.
  const hash = (await scryptAsync(password, user?.salt ?? "xt-unknown-account", 64)) as Buffer;
  const expected = user ? Buffer.from(user.password_hash, "hex") : Buffer.alloc(64);
  if (!timingSafeEqual(hash, expected) || !user)
    throw new CustomerError("Incorrect email or password.", 401);
  registry()
    .prepare("DELETE FROM xt_auth_limits WHERE scope = ?")
    .run(digest(`login:${email}`));
  return { id: user.id, email: user.email, name: user.name };
}

export function createCustomerSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const database = registry();
  database.prepare("DELETE FROM xt_sessions WHERE expires_at <= ?").run(Date.now());
  database
    .prepare("INSERT INTO xt_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)")
    .run(digest(token), userId, Date.now() + SESSION_SECONDS * 1000);
  return token;
}

export function customerForToken(token?: string): User | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    (registry()
      .prepare(
        `SELECT u.id,u.email,u.name FROM xt_users u JOIN xt_sessions s ON s.user_id = u.id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(digest(token), Date.now()) as User | undefined) ?? null
  );
}

export function revokeCustomerSession(token?: string) {
  if (token) registry().prepare("DELETE FROM xt_sessions WHERE token_hash = ?").run(digest(token));
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  let originHost: string | undefined;
  try {
    originHost = origin ? new URL(origin).host : undefined;
  } catch {
    throw new CustomerError("Cross-site requests are not allowed.", 403);
  }
  if (fetchSite === "cross-site" || (originHost !== undefined && originHost !== host))
    throw new CustomerError("Cross-site requests are not allowed.", 403);
}

export async function customerBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new CustomerError("Enter valid account details.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new CustomerError("Request is too large.", 413);
    }
    chunks.push(value);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new CustomerError("Enter valid account details.");
  }
}
