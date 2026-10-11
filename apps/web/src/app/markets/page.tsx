"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChartCandlestick, ExternalLink, Pause, Play } from "lucide-react";
import { useLanguage } from "@/components/language";
import { Button } from "@/components/ui/button";
const Chart = dynamic(() => import("@/components/market-chart"), { ssr: false });
const PAIRS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "USDCAD",
  "USDCHF",
  "NZDUSD",
  "EURJPY",
  "GBPJPY",
  "EURGBP",
  "XAUUSD",
  "XAGUSD",
];
const PERIODS: [string, string][] = [
  ["1", "1m"],
  ["5", "5m"],
  ["15", "15m"],
  ["60", "1h"],
  ["240", "4h"],
  ["D", "1D"],
];
export default function MarketsPage() {
  const { t } = useLanguage();
  const [pair, setPair] = useState("EURUSD");
  const [interval, setInterval] = useState("60");
  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-widest text-brand">XT / MARKET WORKSPACE</p>
          <h1 className="mt-2 text-2xl font-semibold">{t("Markets")}</h1>
        </div>
        <Link href="/trades" className="text-sm text-brand">
          {t("Open trade journal")} →
        </Link>
      </header>
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <div className="flex items-center gap-3">
            <ChartCandlestick className="h-5 w-5 text-brand" />
            <label className="sr-only" htmlFor="market-pair">
              {t("Symbol")}
            </label>
            <select
              id="market-pair"
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 font-semibold"
            >
              {PAIRS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <span className="hidden text-xs text-muted-foreground sm:block">
              FOREX & METALS / UTC+8
            </span>
          </div>
          <div className="flex flex-wrap gap-1" aria-label={t("Chart interval")}>
            {PERIODS.map(([value, label]) => (
              <Button
                key={value}
                variant={interval === value ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={interval === value}
                onClick={() => setInterval(value)}
              >
                {label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setPaused(!paused)}>
              {paused ? <Play /> : <Pause />}
              {t(paused ? "Resume chart" : "Pause chart")}
            </Button>
          </div>
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_180px]">
          <div className="h-[68dvh] min-h-[460px] max-h-[900px] min-w-0">
            {paused ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("Chart paused to save resources.")}
              </div>
            ) : (
              <Chart key={revision} symbol={`OANDA:${pair}`} interval={interval} />
            )}
          </div>
          <aside className="hidden border-l p-3 lg:block">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Watchlist")}
            </h2>
            {PAIRS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPair(p)}
                aria-pressed={pair === p}
                className={`mb-1 flex w-full justify-between rounded-md px-3 py-2 text-xs ${pair === p ? "bg-brand/10 text-brand" : "hover:bg-accent"}`}
              >
                <span>{p}</span>
                <span className="text-muted-foreground">{p.startsWith("XA") ? "METAL" : "FX"}</span>
              </button>
            ))}
          </aside>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
          <span>{t("Chart quotes may differ from your broker. Trading is not connected.")}</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="underline"
              onClick={() => {
                setPaused(false);
                setRevision((n) => n + 1);
              }}
            >
              {t("Reload chart")}
            </button>
            <a
              href={`https://www.tradingview.com/chart/?symbol=OANDA%3A${pair}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              TradingView <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </footer>
      </section>
    </div>
  );
}
