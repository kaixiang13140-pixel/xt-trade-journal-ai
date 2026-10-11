# XT forex workspace

## Delivered

- Password visibility toggle on login, registration and password-change forms. Hidden by default; visibility buttons never submit the form.
- Dark charcoal/teal authentication layout, responsive CSS, XT SVG mark and browser icon.
- `/brokers`: searchable directory of 24 commonly encountered forex brokers. Selecting a broker creates a manual/import journal account, not a live broker connection. Custom names remain available.
- `/markets`: TradingView Advanced Chart with forex/metals presets, timeframe selection, drawing toolbar, watchlist, pause/resume, reload and external fallback link. Attribution is preserved. This widget does not execute orders.
- The chart module is dynamically imported only on the markets route. Exactly one widget is mounted, with cleanup on changes/navigation. Pause removes it. No chart scripts on login or journal pages.
- Auth artwork is a 33,346-byte WebP; the icon is vector. No continuously animated background.

Chart data availability and latency depend on TradingView and network conditions. Quotes can differ from the customer's execution broker. This implementation does not guarantee zero lag or persistent chart drawings across reloads.

## MT5 follow-up design (not implemented)

A full platform needs an independently authenticated connector, not a broker-name dropdown. Start with one specified broker/server and a demo account.

1. Read-only connector: MT5 terminal on an always-on Windows host; ingest historical deals plus current positions/orders. Bind each connector credential to one customer/account. Deduplicate deal tickets, use incremental checkpoints and overlap reconciliation, handle deposits/fees and reconnects. The website must show last successful sync and stale/offline status.
2. Demo execution: authenticated order intent, explicit user confirmation, broker symbol mapping, volume/step validation, SL/TP distance checks, margin checks, idempotency keys and execution reconciliation. Ambiguous timeouts must reconcile before any retry. Never treat a TradingView quote as the execution price.
3. Live execution: enable only after broker compatibility and demo end-to-end verification; separate read-only/execution permissions, rate limits, audit logs and a disable-trading switch. Credentials stay server-side. A per-customer terminal/connection architecture must be decided before scaling.

The official Python API connects to an MT5 terminal and exposes order_send. Website hosting alone does not provide that connection. A Windows host/terminal must remain online if using this architecture. Broker-provided APIs or approved commercial connectors are alternatives with separate access and pricing requirements.

Official references:

- https://www.mql5.com/en/docs/python_metatrader5/mt5initialize_py
- https://www.mql5.com/en/docs/python_metatrader5/mt5ordersend_py
- https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/

## Artwork provenance

Background generated with the built-in image-generation tool, then resized to 1440 pixels and encoded as WebP. Original generated PNG was retained outside the repository. Final asset: `apps/web/public/brand/xt-auth.webp`. XT SVG was authored directly in code.

Final generation prompt: Premium XT Trade Journal AI login background; near-black charcoal matte-glass architectural ribbons; restrained turquoise/teal edge highlights (#54dbc5); candlestick-inspired geometric prisms and light paths on the left third; quiet graphite grain and dark negative space on the right half; elegant, minimal institutional trading-terminal mood. Landscape 1536×1024. No words, letters, numbers, logos, axes, people, purple, busy decoration or exaggerated neon. Decorative abstract art, not a data chart.

## Validation

Existing 583 tests passed, plus two new password/chart lifecycle tests. Production build passed. Browser screenshot and live external-chart rendering checks could not be completed because the environment's Chromium download failed; verify these on desktop, tablet and phone before a customer rollout.
