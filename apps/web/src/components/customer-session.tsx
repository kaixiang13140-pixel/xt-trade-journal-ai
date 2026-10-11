"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useApi, postJson } from "@/lib/use-api";
import { Button } from "./ui/button";
import { I18nText, useLanguage } from "./language";

export function CustomerSession({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { data } = useApi<{ customerMode: boolean; user: { name: string } | null }>(
    pathname === "/login" ? null : "/api/customer/session",
  );
  if (!data?.customerMode || !data.user) return null;
  return (
    <div className={compact ? "shrink-0" : "space-y-1 border-t px-3 py-2"}>
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
        onClick={async () => {
          await postJson("/api/customer/logout", {});
          window.location.assign("/login");
        }}
      >
        {compact ? <LogOut className="h-4 w-4" /> : <I18nText text="Sign out" />}
      </Button>
    </div>
  );
}
