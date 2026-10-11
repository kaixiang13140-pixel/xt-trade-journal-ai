"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { XTMark } from "@/components/xt-mark";
import { LanguageToggle, useLanguage } from "@/components/language";
import { postJson, useApi } from "@/lib/use-api";

export default function LoginPage() {
  const { t } = useLanguage();
  const { data, error: sessionError } = useApi<{
    customerMode: boolean;
    invitationRequired: boolean;
  }>("/api/customer/session");
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customerMode = data?.customerMode === true;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !data) return;
    setSaving(true);
    setError(null);
    try {
      if (customerMode) {
        await postJson(registering ? "/api/customer/register" : "/api/customer/login", {
          name,
          email,
          password,
          invitationCode,
        });
      } else await postJson("/api/auth", { password });
      // A full navigation clears the previous customer's in-memory API caches.
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account creation failed.");
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="mb-4 flex justify-end">
            <LanguageToggle compact />
          </div>
          <div className="mb-6 text-center">
            <XTMark className="mx-auto mb-3 h-12 w-12 text-brand" />
            <h1 className="text-xl font-semibold">XT Trade Journal AI</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("Desktop, tablet and phone — one account.")}
            </p>
          </div>
          {!data ? (
            <p role="status" className="text-center text-sm">
              {sessionError ?? t("Loading…")}
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {customerMode && registering && (
                <div className="space-y-1.5">
                  <Label htmlFor="xt-name">{t("Your name")}</Label>
                  <Input
                    id="xt-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    required
                    disabled={saving}
                  />
                </div>
              )}
              {customerMode && (
                <div className="space-y-1.5">
                  <Label htmlFor="xt-email">{t("Email")}</Label>
                  <Input
                    id="xt-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                    maxLength={254}
                    required
                    disabled={saving}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="xt-password">{t("Password")}</Label>
                <Input
                  id="xt-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={registering ? "new-password" : "current-password"}
                  minLength={registering ? 12 : 1}
                  maxLength={128}
                  placeholder={registering ? t("Use 12–128 characters") : ""}
                  required
                  disabled={saving}
                />
              </div>
              {customerMode && registering && data.invitationRequired && (
                <div className="space-y-1.5">
                  <Label htmlFor="xt-invitation">{t("Invitation code")}</Label>
                  <Input
                    id="xt-invitation"
                    value={invitationCode}
                    onChange={(event) => setInvitationCode(event.target.value)}
                    required
                    disabled={saving}
                    maxLength={256}
                    autoComplete="off"
                  />
                </div>
              )}
              {error && (
                <p role="alert" className="text-sm text-loss">
                  {t(error)}
                </p>
              )}
              <Button type="submit" className="h-11 w-full" disabled={saving}>
                {t(
                  saving
                    ? registering
                      ? "Creating…"
                      : "Signing in…"
                    : customerMode
                      ? registering
                        ? "Create your account"
                        : "Sign in"
                      : "Unlock",
                )}
              </Button>
              {customerMode && (
                <>
                  <div className="flex flex-wrap items-center justify-center gap-1 text-sm">
                    <span className="text-muted-foreground">
                      {t(registering ? "Already have an account?" : "New to XT?")}
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      disabled={saving}
                      onClick={() => {
                        setRegistering(!registering);
                        setPassword("");
                        setError(null);
                      }}
                    >
                      {t(registering ? "Sign in" : "Create one")}
                    </Button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    {t("Private journal. Your records stay in your account.")}
                  </p>
                </>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
