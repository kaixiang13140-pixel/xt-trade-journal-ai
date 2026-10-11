// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import MarketChart from "../src/components/market-chart";
vi.mock("@/components/theme", () => ({ useTheme: () => ({ theme: "dark", ready: true }) }));
it("loads one chart, replaces it on symbol change and removes it on navigation", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(createElement(MarketChart, { symbol: "OANDA:EURUSD", interval: "60" })),
    );
    await act(async () => vi.advanceTimersByTime(201));
    let script = host.querySelector("script")!;
    expect(JSON.parse(script.textContent!).symbol).toBe("OANDA:EURUSD");
    expect(host.textContent).toContain("by TradingView");
    await act(async () =>
      root.render(createElement(MarketChart, { symbol: "OANDA:XAUUSD", interval: "15" })),
    );
    await act(async () => vi.advanceTimersByTime(201));
    expect(script.isConnected).toBe(false);
    expect(host.querySelectorAll("script")).toHaveLength(1);
    script = host.querySelector("script")!;
    expect(JSON.parse(script.textContent!).interval).toBe("15");
    await act(async () => {
      script.dispatchEvent(new Event("error"));
    });
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    expect(host.children).toHaveLength(0);
    host.remove();
    vi.useRealTimers();
  }
});
