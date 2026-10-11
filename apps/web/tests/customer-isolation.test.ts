import { afterAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (jar.token ? { value: jar.token } : undefined) }),
}));
const directory = mkdtempSync(join(tmpdir(), "xt-customers-"));
const prior = {
  directory: process.env.JOURNAL_DATA_DIR,
  mode: process.env.XT_MULTIUSER,
  key: process.env.OPENAI_API_KEY,
  code: process.env.XT_REGISTRATION_CODE,
};
process.env.JOURNAL_DATA_DIR = directory;
process.env.XT_MULTIUSER = "1";
process.env.OPENAI_API_KEY = "server-owner-key-not-for-customers";
const {
  registerCustomer,
  loginCustomer,
  createCustomerSession,
  customerForToken,
  revokeCustomerSession,
  requireSameOrigin,
  authLimit,
  customerBody,
  verifyRegistrationCode,
} = await import("../src/server/customers");
const { withCustomer } = await import("../src/server/tenant");
const { db, dataDir, accounts, attachments } = await import("../src/db");
const { encryptJson, decryptJson } = await import("../src/server/crypto");
const { setSetting, getSetting, aiKeyEnvironment } = await import("../src/server/settings");
const { GET: getAccounts, POST: createAccount } = await import("../src/app/api/accounts/route");
const { PATCH: editAccount } = await import("../src/app/api/accounts/[id]/route");
const { GET: getAttachment } = await import("../src/app/api/attachments/[id]/route");
const { createMarketTransport } = await import("../src/server/market-data/transport");
const password = "customer-test-password-2026";
const alice = await registerCustomer({ email: "Alice@example.test", name: "Alice", password });
const bob = await registerCustomer({ email: "bob@example.test", name: "Bob", password });
const aliceToken = createCustomerSession(alice.id);
const bobToken = createCustomerSession(bob.id);

afterAll(() => {
  for (const user of [alice, bob]) withCustomer(user.id, () => db.$client.close());
  process.env.JOURNAL_DATA_DIR = prior.directory;
  if (prior.directory === undefined) delete process.env.JOURNAL_DATA_DIR;
  if (prior.mode === undefined) delete process.env.XT_MULTIUSER;
  else process.env.XT_MULTIUSER = prior.mode;
  if (prior.key === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = prior.key;
  if (prior.code === undefined) delete process.env.XT_REGISTRATION_CODE;
  else process.env.XT_REGISTRATION_CODE = prior.code;
  rmSync(directory, { recursive: true, force: true });
});

describe("customer identities", () => {
  it("normalizes email, verifies a password, and never stores plaintext passwords or tokens", async () => {
    expect((await loginCustomer("ALICE@example.test", password)).id).toBe(alice.id);
    await expect(loginCustomer(alice.email, "wrong-password")).rejects.toMatchObject({
      status: 401,
    });
    const registry = new Database(join(directory, "xt-users.sqlite"));
    const user = registry.prepare("SELECT * FROM xt_users WHERE id=?").get(alice.id) as Record<
      string,
      unknown
    >;
    expect(user.password_hash).not.toBe(password);
    expect(JSON.stringify(user)).not.toContain(password);
    expect(registry.prepare("SELECT token_hash FROM xt_sessions").all()).not.toContainEqual({
      token_hash: aliceToken,
    });
    registry.close();
  });
  it("rejects weak passwords and duplicate identities", async () => {
    await expect(
      registerCustomer({ email: "new@example.test", name: "New", password: "short" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      registerCustomer({ email: alice.email, name: "Other", password }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("supports independent sessions across devices, expiry, revocation, and forged-token rejection", () => {
    const phone = createCustomerSession(alice.id);
    expect(customerForToken(phone)?.id).toBe(alice.id);
    expect(customerForToken(aliceToken)?.id).toBe(alice.id);
    revokeCustomerSession(phone);
    expect(customerForToken(phone)).toBeNull();
    expect(customerForToken(aliceToken)?.id).toBe(alice.id);
    expect(customerForToken("0".repeat(64))).toBeNull();
    expect(customerForToken("../../other")).toBeNull();
    const expired = createCustomerSession(bob.id);
    const registry = new Database(join(directory, "xt-users.sqlite"));
    registry
      .prepare(
        "UPDATE xt_sessions SET expires_at=0 WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM xt_sessions WHERE user_id=?)",
      )
      .run(bob.id, alice.id);
    expect(customerForToken(expired)).toBeNull();
    registry.close();
    // Keep Bob's test session active for subsequent authorization checks.
    jar.token = createCustomerSession(bob.id);
  });
  it("rate limits repeated attempts and enforces invitation codes", () => {
    authLimit("unit-test-limit", 1);
    expect(() => authLimit("unit-test-limit", 1)).toThrow("Too many attempts");
    process.env.XT_REGISTRATION_CODE = "private-pilot-code";
    expect(() => verifyRegistrationCode("wrong")).toThrow("Invalid invitation");
    expect(() => verifyRegistrationCode("private-pilot-code")).not.toThrow();
    delete process.env.XT_REGISTRATION_CODE;
  });
  it("rejects cross-site writes and oversized or malformed registration bodies", async () => {
    expect(() =>
      requireSameOrigin(
        new Request("https://xt.example/api/accounts", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow("Cross-site");
    expect(() =>
      requireSameOrigin(
        new Request("https://xt.example/api/accounts", {
          method: "POST",
          headers: { origin: "https://xt.example" },
        }),
      ),
    ).not.toThrow();
    await expect(
      customerBody(
        new Request("https://xt.example/api/customer/login", { method: "POST", body: "{" }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      customerBody(
        new Request("https://xt.example/api/customer/login", {
          method: "POST",
          body: "x".repeat(9000),
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
});

describe("customer data isolation", () => {
  it("keeps shared process market caches separate for different customers", async () => {
    const transport = createMarketTransport({ minIntervalMs: 0 });
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json({ customer: (await import("../src/server/tenant")).currentCustomer() }),
      );
    try {
      const url = "https://example.test/candles?end=2025-01-01";
      expect(await withCustomer(alice.id, () => transport.read(url))).toEqual({
        customer: alice.id,
      });
      expect(await withCustomer(bob.id, () => transport.read(url))).toEqual({ customer: bob.id });
      expect(await withCustomer(alice.id, () => transport.read(url))).toEqual({
        customer: alice.id,
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      fetcher.mockRestore();
    }
  });
  it("fails closed without a customer context and rejects path traversal", () => {
    expect(() => db.select().from(accounts).all()).toThrow("customer context");
    expect(() => withCustomer("../../someone-else", () => dataDir())).toThrow("Invalid customer");
  });
  it("isolates overlapping record IDs, settings and encryption material even during concurrent requests", async () => {
    await Promise.all(
      [alice, bob].map((user) =>
        withCustomer(user.id, async () => {
          db.insert(accounts)
            .values({
              id: "same-id",
              name: user.name,
              kind: "manual",
              currency: "USD",
              createdAt: "2026-01-01",
            })
            .run();
          await new Promise((resolve) => setTimeout(resolve, user === alice ? 8 : 2));
          expect(db.select().from(accounts).where(eq(accounts.id, "same-id")).get()?.name).toBe(
            user.name,
          );
          setSetting("private-note", user.name);
          expect(getSetting("private-note")).toBe(user.name);
        }),
      ),
    );
    const secret = withCustomer(alice.id, () => encryptJson({ key: "alice-secret" }));
    expect(withCustomer(alice.id, () => decryptJson(secret))).toEqual({ key: "alice-secret" });
    expect(() => withCustomer(bob.id, () => decryptJson(secret))).toThrow();
    expect(aiKeyEnvironment("openai")).toBeNull();
  });
  it("guards real API handlers and blocks another customer's record ID", async () => {
    jar.token = undefined;
    expect((await getAccounts(new Request("http://localhost/api/accounts"))).status).toBe(401);
    jar.token = aliceToken;
    const created = await createAccount(
      new Request("http://localhost/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: "Alice private account",
          kind: "manual",
          currency: "USD",
          initialBalance: 500,
        }),
      }),
    );
    expect(created.status).toBe(200);
    const { id } = await created.json();
    const aliceAccounts = await (
      await getAccounts(new Request("http://localhost/api/accounts"))
    ).json();
    expect(JSON.stringify(aliceAccounts)).toContain("Alice private account");
    jar.token = createCustomerSession(bob.id);
    const bobAccounts = await (
      await getAccounts(new Request("http://localhost/api/accounts"))
    ).json();
    expect(JSON.stringify(bobAccounts)).not.toContain("Alice private account");
    const changed = await editAccount(
      new Request(`http://localhost/api/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "stolen" }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(changed.status).toBeGreaterThanOrEqual(400);
  });
  it("never serves another customer's uploaded attachment", async () => {
    withCustomer(alice.id, () =>
      db
        .insert(attachments)
        .values({
          id: "alice-private-file",
          ownerType: "day",
          ownerId: "2026-01-01",
          name: "private.pdf",
          mime: "application/pdf",
          size: 3,
          data: Buffer.from("abc"),
          createdAt: "2026-01-01",
        })
        .run(),
    );
    jar.token = aliceToken;
    expect(
      (
        await getAttachment(new Request("http://localhost/api/attachments/alice-private-file"), {
          params: Promise.resolve({ id: "alice-private-file" }),
        })
      ).status,
    ).toBe(200);
    jar.token = createCustomerSession(bob.id);
    expect(
      (
        await getAttachment(new Request("http://localhost/api/attachments/alice-private-file"), {
          params: Promise.resolve({ id: "alice-private-file" }),
        })
      ).status,
    ).toBe(404);
  });
});
