"use client";

import { useState } from "react";
import { useApi, postJson } from "@/lib/use-api";
import { useLanguage } from "./language";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function CustomerSettings() {
  const { t } = useLanguage();
  const { data } = useApi<{ customerMode: boolean; user: { email: string; name: string } | null }>(
    "/api/customer/session",
  );
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  if (!data?.customerMode || !data.user) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setSaved(false);
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await postJson("/api/customer/password", { currentPassword: current, newPassword: password });
      setCurrent("");
      setPassword("");
      setConfirm("");
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Account security")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="break-all text-sm text-muted-foreground">{data.user.email}</p>
        <p className="text-sm text-muted-foreground">
          {t("Changing your password signs out your other devices. This device stays signed in.")}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">{t("Current password")}</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={current}
                maxLength={128}
                required
                onChange={(event) => setCurrent(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">{t("New password")}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                minLength={12}
                maxLength={128}
                required
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("Use 12–128 characters")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">{t("Confirm new password")}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                minLength={12}
                maxLength={128}
                required
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>
            <Button type="submit">{t(busy ? "Saving…" : "Change password")}</Button>
          </fieldset>
        </form>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(error)}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("Password changed. Other devices have been signed out.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
