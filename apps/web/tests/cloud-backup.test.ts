import { afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import Database from "better-sqlite3";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (jar.token ? { value: jar.token } : undefined) }),
}));
const dir = mkdtempSync(join(tmpdir(), "xt-backup-audit-"));
const oldMode = process.env.XT_MULTIUSER,
  oldDir = process.env.JOURNAL_DATA_DIR;
process.env.XT_MULTIUSER = "1";
process.env.JOURNAL_DATA_DIR = dir;
const { registerCustomer, createCustomerSession } = await import("../src/server/customers");
const { withCustomer } = await import("../src/server/tenant");
const { db, accounts, executions, trades, notes, attachments, settings } =
  await import("../src/db");
const { captureSnapshot, MAX_SNAPSHOT_BYTES } = await import("../src/server/cloud-backup-snapshot");
const { rebuildAccount } = await import("../src/server/rebuild");
const { POST } = await import("../src/app/api/cloud/backup/route");
const alice = await registerCustomer({
  email: "alice@example.test",
  name: "Alice",
  password: "local-password-123",
});
const bob = await registerCustomer({
  email: "bob@example.test",
  name: "Bob",
  password: "local-password-123",
});
const empty = await registerCustomer({
  email: "empty@example.test",
  name: "Empty",
  password: "local-password-123",
});
const aliceToken = createCustomerSession(alice.id),
  bobToken = createCustomerSession(bob.id),
  emptyToken = createCustomerSession(empty.id);
for (const person of [alice, bob])
  withCustomer(person.id, () => {
    db.insert(accounts)
      .values({
        id: "a",
        name: person.name,
        broker: "VT Markets",
        kind: "manual",
        currency: "USD",
        credentialsEnc: "BROKER_SECRET",
        snapshotJson: '{"token":"SNAPSHOT_SECRET"}',
        createdAt: "2026-10-12",
      })
      .run();
    db.insert(executions)
      .values({
        id: "e",
        accountId: "a",
        symbol: "EURUSD",
        side: "buy",
        quantity: 1,
        price: 1.1,
        fee: 0,
        executedAt: "2026-10-12T00:00:00Z",
        source: "manual",
        contentHash: "fill",
        importMetadataJson: '{"apiKey":"IMPORT_SECRET"}',
        createdAt: "2026-10-12",
      })
      .run();
    db.insert(notes)
      .values({
        id: "n",
        folderId: "my-notes",
        title: person.name + " private",
        content: "Private note",
        createdAt: "2026-10-12",
        updatedAt: "2026-10-12",
      })
      .run();
    db.insert(settings).values({ key: "openaiKeyEnc", value: "AI_SECRET" }).run();
    db.insert(attachments)
      .values({
        id: "file",
        ownerType: "note",
        ownerId: "n",
        name: "f",
        mime: "image/png",
        size: 4,
        data: Buffer.from("FILE"),
        createdAt: "2026-10-12",
      })
      .run();
    rebuildAccount("a");
    // Newly added fields must not leak through a future schema change.
    db.$client.exec("ALTER TABLE trades ADD COLUMN future_secret TEXT");
  });
const cloudId = "00000000-0000-4000-8000-000000000001";
const fetchMock = vi.fn();
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const request = (
  body: unknown = { email: alice.email, password: "shortpw", confirmBackup: true },
  origin = "http://localhost:3000",
  host = "localhost:3000",
) =>
  new Request(`http://${host}/api/cloud/backup`, {
    method: "POST",
    headers: { Origin: origin, Host: host, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
function service(email = alice.email) {
  fetchMock.mockImplementation(async (input: URL | string, init: RequestInit) => {
    const url = new URL(input.toString());
    if (url.pathname === "/auth/v1/token")
      return response({ access_token: "temporary-access", user: { id: cloudId, email } });
    if (url.pathname === "/auth/v1/user") return response({ id: cloudId, email });
    if (url.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
    const record = JSON.parse(init.body as string);
    return response([
      {
        user_id: record.user_id,
        format_version: 1,
        captured_at: record.captured_at,
        account_count: record.account_count,
        execution_count: record.execution_count,
        trade_count: record.trade_count,
      },
    ]);
  });
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("SUPABASE_URL", "https://test-project.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_only");
  jar.token = aliceToken;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  service();
  // Reset only isolated test rate-limit state, never a user's real registry.
  const registry = new Database(join(dir, "xt-users.sqlite"));
  registry.exec("DELETE FROM xt_auth_limits");
  registry.close();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(() => {
  for (const user of [alice, bob, empty]) withCustomer(user.id, () => db.$client.close());
  const shared = globalThis as unknown as { __xtRegistries?: Map<string, Database.Database> };
  shared.__xtRegistries?.get(dir)?.close();
  shared.__xtRegistries?.delete(dir);
  if (oldMode === undefined) delete process.env.XT_MULTIUSER;
  else process.env.XT_MULTIUSER = oldMode;
  if (oldDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = oldDir;
  rmSync(dir, { recursive: true, force: true });
});
describe("manual cloud backup route", () => {
  it("uploads only the signed-in tenant's selected fields, confirms metadata and revokes its temporary session", async () => {
    const result = await POST(request());
    expect(result.status).toBe(200);
    const write = fetchMock.mock.calls.find(([u]) =>
      new URL(u.toString()).pathname.startsWith("/rest/"),
    )!;
    const record = JSON.parse(write[1].body);
    expect(record.user_id).toBe(cloudId);
    expect(record.payload.accounts[0].name).toBe("Alice");
    expect(record.payload.notes[0].title).toBe("Alice private");
    const serialized = write[1].body as string;
    for (const secret of [
      "BROKER_SECRET",
      "SNAPSHOT_SECRET",
      "IMPORT_SECRET",
      "AI_SECRET",
      "future_secret",
      "FILE",
    ])
      expect(serialized).not.toContain(secret);
    expect(new URL(write[0].toString()).searchParams.get("select")).not.toContain("payload");
    const body = await result.json();
    expect(body.counts).toEqual({ accounts: 1, executions: 1, trades: 1, notes: 1 });
    expect(JSON.stringify(body)).not.toContain("temporary-access");
    const logout = fetchMock.mock.calls.at(-1)!;
    expect(new URL(logout[0].toString()).search).toBe("?scope=local");
    expect(fetchMock.mock.calls.every(([, init]) => init.redirect === "error")).toBe(true);
    withCustomer(alice.id, () => {
      expect(db.select().from(accounts).get()!.credentialsEnc).toBe("BROKER_SECRET");
      expect(db.select().from(executions).all()).toHaveLength(1);
    });
  });
  it("scopes a different tenant without merging local and cloud IDs", async () => {
    jar.token = bobToken;
    service(bob.email);
    const result = await POST(
      request({ email: bob.email, password: "shortpw", confirmBackup: true }),
    );
    expect(result.status).toBe(200);
    const write = fetchMock.mock.calls.find(([u]) =>
      new URL(u.toString()).pathname.startsWith("/rest/"),
    )!;
    expect(JSON.parse(write[1].body).payload.accounts[0].name).toBe("Bob");
  });
  it.each(["production", "test"])("is unavailable in %s", async (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    expect((await POST(request())).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects a non-loopback request", async () => {
    expect((await POST(request(undefined, "http://xt.example", "xt.example"))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects cross-site POSTs before any network upload", async () => {
    expect((await POST(request(undefined, "https://evil.example"))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires the existing local login", async () => {
    jar.token = undefined;
    expect((await POST(request())).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation", async () => {
    expect(
      (await POST(request({ email: alice.email, password: "shortpw", confirmBackup: false })))
        .status,
    ).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects another cloud email", async () => {
    expect(
      (await POST(request({ email: bob.email, password: "shortpw", confirmBackup: true }))).status,
    ).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    "http://test.supabase.co",
    "https://test.supabase.co.evil.example",
    "https://test.supabase.co/path",
    "https://test.supabase.co?x=1",
  ])("rejects invalid project URL %s", async (url) => {
    vi.stubEnv("SUPABASE_URL", url);
    expect((await POST(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not authenticate or upload an empty journal", async () => {
    jar.token = emptyToken;
    expect(
      (await POST(request({ email: empty.email, password: "shortpw", confirmBackup: true })))
        .status,
    ).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects mismatched token identity and closes the temporary session", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({ access_token: "temporary-access", user: { id: cloudId, email: alice.email } }),
      )
      .mockResolvedValueOnce(
        response({ id: "00000000-0000-4000-8000-000000000002", email: alice.email }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect((await POST(request())).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("rate limits repeated uploads", async () => {
    for (let i = 0; i < 6; i++) expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(429);
  });
  it("bounds the incoming body before logging in", async () => {
    expect(
      (
        await POST(
          request({
            email: alice.email,
            password: "shortpw",
            confirmBackup: true,
            extra: "x".repeat(9000),
          }),
        )
      ).status,
    ).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects a stale confirmation and avoids leaking provider details", async () => {
    service();
    const implementation = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (u, init) =>
      new URL(u.toString()).pathname.startsWith("/rest/")
        ? response([
            {
              user_id: cloudId,
              format_version: 1,
              captured_at: "2000-01-01",
              account_count: 1,
              execution_count: 1,
              trade_count: 1,
            },
          ])
        : implementation(u, init),
    );
    const result = await POST(request());
    expect(result.status).toBe(502);
    expect((await result.json()).error).toContain("before retrying");
    expect(fetchMock.mock.calls.at(-1)![0].toString()).toContain("/logout");
  });
  it.each(["counts", "version", "owner", "multiple", "malformed", "oversized"])(
    "rejects %s upload confirmation and still cleans up the session",
    async (kind) => {
      const implementation = fetchMock.getMockImplementation()!;
      fetchMock.mockImplementation(async (u, init) => {
        if (!new URL(u.toString()).pathname.startsWith("/rest/")) return implementation(u, init);
        const record = JSON.parse(init.body as string);
        const row = {
          user_id: record.user_id,
          format_version: 1,
          captured_at: record.captured_at,
          account_count: 1,
          execution_count: 1,
          trade_count: 1,
        };
        if (kind === "counts") row.account_count = 2;
        if (kind === "version") row.format_version = 2;
        if (kind === "owner") row.user_id = "00000000-0000-4000-8000-000000000003";
        if (kind === "malformed") return new Response("{not json}");
        if (kind === "oversized")
          return response([row], 200)
            .text()
            .then((text) => new Response(text + " ".repeat(17000)));
        return response(kind === "multiple" ? [row, row] : [row]);
      });
      expect((await POST(request())).status).toBe(502);
      expect(fetchMock.mock.calls.at(-1)![0].toString()).toContain("/logout");
    },
  );
  it("preserves a successful upload result if best-effort session cleanup fails", async () => {
    const implementation = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (u, init) => {
      if (new URL(u.toString()).pathname === "/auth/v1/logout") throw new Error("unavailable");
      return implementation(u, init);
    });
    expect((await POST(request())).status).toBe(200);
  });
  it("does not retry an ambiguous write failure", async () => {
    const implementation = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (u, init) => {
      if (new URL(u.toString()).pathname.startsWith("/rest/"))
        throw Error("SECRET_CONNECTION_DETAIL");
      return implementation(u, init);
    });
    const result = await POST(request());
    expect(result.status).toBe(502);
    expect(JSON.stringify(await result.json())).not.toContain("SECRET_CONNECTION_DETAIL");
    expect(fetchMock.mock.calls.filter(([u]) => u.toString().includes("/rest/")).length).toBe(1);
  });
  it("does not report an unsuccessful write as success", async () => {
    const implementation = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (u, init) =>
      new URL(u.toString()).pathname.startsWith("/rest/")
        ? response({ secret: "PROVIDER_DETAIL" }, 403)
        : implementation(u, init),
    );
    const result = await POST(request());
    expect(result.status).toBe(502);
    expect(JSON.stringify(await result.json())).not.toContain("PROVIDER_DETAIL");
  });
});
describe("bounded consistent SQLite snapshot", () => {
  it("keeps a consistent read snapshot when another connection writes during capture", () =>
    withCustomer(alice.id, () => {
      const sqlite = db.$client;
      const other = new Database(join(dir, "customers", alice.id, "journal.db"));
      const prepare = sqlite.prepare.bind(sqlite);
      const transactionStates: boolean[] = [];
      let wrote = false;
      const spy = vi.spyOn(sqlite, "prepare").mockImplementation((query: string) => {
        if (/^select/i.test(query)) transactionStates.push(sqlite.inTransaction);
        if (!wrote && /from "notes"/i.test(query)) {
          wrote = true;
          other.prepare("UPDATE notes SET content='Other committed value' WHERE id='n'").run();
        }
        return prepare(query);
      });
      try {
        const record = captureSnapshot();
        expect(wrote).toBe(true);
        expect(record.payload.notes[0]!.content).toBe("Private note");
        expect(other.prepare("SELECT content FROM notes WHERE id='n'").get()).toEqual({
          content: "Other committed value",
        });
        expect(transactionStates.length).toBeGreaterThan(0);
        expect(transactionStates.every(Boolean)).toBe(true);
        expect(JSON.stringify(record)).not.toContain("future_secret");
      } finally {
        spy.mockRestore();
        other.close();
        db.update(notes).set({ content: "Private note" }).where(eq(notes.id, "n")).run();
      }
    }));
  it("rejects both large source data and JSON-escaped overflow before contacting Supabase", async () => {
    for (const content of ["x".repeat(MAX_SNAPSHOT_BYTES), "\u0001".repeat(145000)]) {
      withCustomer(alice.id, () =>
        db.update(notes).set({ content }).where(eq(notes.id, "n")).run(),
      );
      expect((await POST(request())).status).toBe(413);
      expect(fetchMock).not.toHaveBeenCalled();
    }
    withCustomer(alice.id, () =>
      db.update(notes).set({ content: "Private note" }).where(eq(notes.id, "n")).run(),
    );
  });
});
