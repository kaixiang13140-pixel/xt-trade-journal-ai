"use client";
import { useState, type FormEvent } from "react";

type UploadResult = {
  status?: string;
  capturedAt?: string;
  counts?: { accounts: number; executions: number; trades: number; notes: number };
  error?: string;
};

export function CloudBackupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setSuccess(false);
    setMessage("Uploading your manual snapshot...");
    try {
      const response = await fetch("/api/cloud/backup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmBackup: true }),
        cache: "no-store",
      });
      const data = (await response.json()) as UploadResult;
      if (response.ok && data.status === "uploaded" && data.counts) {
        setSuccess(true);
        setMessage(
          `Uploaded at ${data.capturedAt ?? "unknown time"} — ${data.counts.accounts} account(s), ${data.counts.executions} execution(s), ${data.counts.trades} trade(s), ${data.counts.notes} note(s). Verify the xt_cloud_backups table in Supabase.`,
        );
      } else {
        setMessage(data.error ?? "Upload failed.");
      }
    } catch {
      setMessage("Network error during upload. Check the cloud table before retrying.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          XT AI · Local Development Pilot
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Manual cloud snapshot</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Copy selected trading accounts, executions, trades, journal days, notes and playbooks from
          the currently signed-in XT account to your own Supabase test account. Your local SQLite
          records stay untouched. Broker passwords and API keys are excluded.
        </p>
        <p className="mt-3 text-sm font-semibold text-foreground">
          This is a test copy, not automatic sync or a complete backup. There is no cloud restore
          yet. Uploading again replaces your previous cloud snapshot. Keep your original local
          backup.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="cloud-backup-email" className="mb-1 block text-sm font-medium">
              Supabase test email (must match signed-in XT email)
            </label>
            <input
              id="cloud-backup-email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="cloud-backup-password" className="mb-1 block text-sm font-medium">
              Supabase test password
            </label>
            <input
              id="cloud-backup-password"
              type="password"
              autoComplete="current-password"
              minLength={1}
              maxLength={128}
              required
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1"
            />
            <span>
              I understand my trading data will be copied to Supabase, the previous cloud snapshot
              will be overwritten, and cloud restore is not yet supported.
            </span>
          </label>
          <button
            type="submit"
            disabled={busy || !confirmed}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Uploading..." : "Upload test snapshot"}
          </button>
        </form>
        {message && (
          <p
            role="status"
            aria-live="polite"
            className={`mt-5 rounded-md border p-3 text-sm ${success ? "border-profit text-profit" : "border-border"}`}
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
