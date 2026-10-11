"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useApi, postJson } from "@/lib/use-api";
import { Button } from "./ui/button";
import { I18nText, useLanguage } from "./language";

export function CustomerSession({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { data } = useApi<{ customerMode: boolean; user: { name: string } | null }>(
    pathname === "/login" ? null : "/api/customer/session",
  );
  useEffect(() => {
    if (data?.customerMode && !data.user && pathname !== "/login")
      window.location.replace("/login");
  }, [data, pathname]);
  if (!data?.customerMode || !data.user) return null;
  return (
    <div className={compact ? "relative shrink-0" : "space-y-1 border-t px-3 py-2"}>
      {!compact && (
        <p className="truncate text-xs text-muted-foreground" title={data.user.name}>
          {data.user.name}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={compact ? "h-8 px-2" : "w-full justify-start"}
        aria-label={t("Sign out")}
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await postJson("/api/customer/logout", {});
            window.location.assign("/login");
          } catch {
            setError("Sign out failed. Please try again.");
            setBusy(false);
          }
        }}
      >
        {compact ? (
          <LogOut className="h-4 w-4" />
        ) : (
          <I18nText text={busy ? "Signing out…" : "Sign out"} />
        )}
      </Button>
      {error && (
        <p
          role="alert"
          className={
            compact
              ? "absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border bg-card p-3 text-xs text-destructive shadow-lg"
              : "text-xs text-destructive"
          }
        >
          {t(error)}
        </p>
      )}
    </div>
  );
}
