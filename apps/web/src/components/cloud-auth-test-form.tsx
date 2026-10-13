"use client";

import { useState, type FormEvent } from "react";

type TestResult = {
  status?: string;
  authenticated?: boolean;
  profileFound?: boolean;
  error?: string;
};

export function CloudAuthTestForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("Checking Supabase...");
    setSuccess(false);
    try {
      const response = await fetch("/api/cloud/auth-test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signin", email, password }),
        cache: "no-store",
      });
      const result = (await response.json()) as TestResult;
      if (response.ok && result.authenticated && result.profileFound) {
        setSuccess(true);
        setMessage("SUCCESS: Supabase sign-in works and your xt_profiles row was found.");
      } else if (response.ok && result.authenticated) {
        setMessage("Signed in to Supabase, but your xt_profiles row was not found.");
      } else {
        setMessage(result.error ?? "Cloud login test failed.");
      }
    } catch {
      setMessage("Unable to contact the local XT test service.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">XT AI · Local Testing</p>
        <h1 className="mt-2 text-2xl font-semibold">Supabase Login Test</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This checks only your Supabase test account and cloud profile.
          Your existing XT AI login and SQLite trading records remain unchanged.
        </p>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="cloud-email" className="mb-1 block text-sm font-medium">Supabase test email</label>
            <input id="cloud-email" type="email" maxLength={254} required
              autoComplete="username" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2" />
          </div>
          <div>
            <label htmlFor="cloud-password" className="mb-1 block text-sm font-medium">Supabase test password</label>
            <input id="cloud-password" type="password" maxLength={128} minLength={12} required
              autoComplete="current-password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2" />
          </div>
          <button disabled={busy} type="submit"
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
            {busy ? "Checking..." : "Test cloud login"}
          </button>
        </form>
        {message && <p role="status" aria-live="polite"
          className={`mt-5 rounded-md border p-3 text-sm ${success ? "border-profit text-profit" : "border-border"}`}>
          {message}
        </p>}
        <p className="mt-5 text-xs text-muted-foreground">
          Use a dedicated test account. Do not send anyone your password.
          This page does not migrate your trading history.
        </p>
      </section>
    </main>
  );
}
