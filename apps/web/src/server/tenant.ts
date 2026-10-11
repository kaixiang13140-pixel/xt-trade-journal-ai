import { AsyncLocalStorage } from "node:async_hooks";
import { join } from "node:path";

export const customerMode = () => process.env.XT_MULTIUSER === "1";
export const baseDataDir = () => process.env.JOURNAL_DATA_DIR ?? join(process.cwd(), "data");
const shared = globalThis as typeof globalThis & { __xtTenantContext?: AsyncLocalStorage<string> };
const context = shared.__xtTenantContext ?? (shared.__xtTenantContext = new AsyncLocalStorage());

export function withCustomer<T>(userId: string, callback: () => T): T {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(userId))
    throw new Error("Invalid customer identity");
  return context.run(userId, callback);
}

export function currentCustomer() {
  const userId = context.getStore();
  if (customerMode() && !userId) throw new Error("An authenticated customer context is required");
  return userId;
}

export function customerDataDir() {
  if (!customerMode()) return baseDataDir();
  return join(baseDataDir(), "customers", currentCustomer()!);
}
