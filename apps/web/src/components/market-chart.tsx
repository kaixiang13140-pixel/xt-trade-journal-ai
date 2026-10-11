"use client";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./language";
import { useTheme } from "./theme";
export default function MarketChart({ symbol, interval }: { symbol: string; interval: string }) {
  const host = useRef<HTMLDivElement>(null);
  const { locale, t } = useLanguage();
  const { theme, ready } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ready || !host.current) return;
    const parent = host.current;
    setFailed(false);
    // An isolated container per effect prevents a late script from attaching to a newer chart.
    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.cssText = "height:100%;width:100%";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.cssText = "height:calc(100% - 32px);width:100%";
    const attribution = document.createElement("div");
    attribution.className = "tradingview-widget-copyright";
    const link = document.createElement("a");
    link.href = "https://www.tradingview.com/chart/?symbol=" + encodeURIComponent(symbol);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${symbol.replace("OANDA:", "")} chart`;
    attribution.append(link, document.createTextNode(" by TradingView"));
    container.append(widget, attribution);
    parent.append(container);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Asia/Singapore",
      theme,
      style: "1",
      locale: locale === "zh" ? "zh_CN" : "en",
      allow_symbol_change: true,
      hide_side_toolbar: false,
      withdateranges: true,
      save_image: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    script.onerror = () => setFailed(true);
    const timer = window.setTimeout(() => container.append(script), 200);
    return () => {
      clearTimeout(timer);
      script.onerror = null;
      container.remove();
    };
  }, [symbol, interval, locale, theme, ready]);
  return (
    <div className="relative h-full min-h-[460px]">
      {failed && (
        <p
          role="alert"
          className="absolute inset-x-4 top-6 z-10 rounded-lg border bg-card p-4 text-sm"
        >
          {t("Chart could not load. Check your connection or open TradingView.")}
        </p>
      )}
      <div ref={host} className="h-full" />
    </div>
  );
}
