"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";
import { FOREX_BROKERS } from "@/lib/forex-brokers";
import { useLanguage } from "@/components/language";
import { Input } from "@/components/ui/input";
export default function BrokersPage() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const brokers = FOREX_BROKERS.filter((b) =>
    b.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-widest text-brand">XT / FOREX</p>
        <h1 className="mt-2 text-2xl font-semibold">{t("Forex brokers")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t(
            "Choose from 24 common forex brokers, or add your own. This is a journal directory, not a broker ranking.",
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label={t("Search brokers")}
            placeholder={t("Search brokers")}
            className="h-10 pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground">{t("Report import / Manual entry")}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {brokers.map((b) => (
          <Link
            href={`/accounts?broker=${b.id}`}
            key={b.id}
            className="group rounded-xl border bg-card p-5 transition-colors hover:border-brand/50"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-sm font-semibold text-brand">
                {b.name.slice(0, 2).toUpperCase()}
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-brand" />
            </div>
            <h2 className="mt-5 font-semibold">{b.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("Add to your journal")}</p>
          </Link>
        ))}
      </div>
      {!brokers.length && <p role="status">{t("No matching brokers")}</p>}
      <p className="text-sm text-muted-foreground">
        {t(
          "Broker selection labels your journal. Use report import or manual entry; it does not enable automatic sync.",
        )}
      </p>
      <Link
        className="inline-block text-sm text-brand underline underline-offset-4"
        href="/accounts"
      >
        {t("Other broker")}
      </Link>
    </div>
  );
}
