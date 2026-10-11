"use client";

import { FOREX_BROKERS } from "@/lib/forex-brokers";
import { I18nText, useLanguage } from "@/components/language";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postJson } from "@/lib/use-api";
import { CurrencyPicker } from "./currency-picker";

export interface CreatedAccount {
  id: string;
  name: string;
  kind: string;
  archivedAt: null;
}

/** Shared local account creation for Import, manual entry and account management. */
export function AccountCreateForm({
  kind,
  initialBroker = "",
  onCreated,
  onSavingChange,
  className,
  showTitle = true,
}: {
  kind?: "import" | "manual";
  initialBroker?: string;
  onCreated: (account: CreatedAccount) => void;
  onSavingChange?: (saving: boolean) => void;
  className?: string;
  showTitle?: boolean;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialBroker);
  const [broker, setBroker] = useState(initialBroker);
  const [customBroker, setCustomBroker] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [balance, setBalance] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accountKind, setAccountKind] = useState<"manual" | "import">("manual");
  const fieldId = useId();
  const create = async () => {
    if (
      saving ||
      !name.trim() ||
      !/^[A-Z]{3}$/.test(currency) ||
      !balance.trim() ||
      !Number.isFinite(Number(balance)) ||
      Number(balance) < 0
    )
      return;
    setSaving(true);
    onSavingChange?.(true);
    setError("");
    try {
      const result = await postJson<{ id: string }>("/api/accounts", {
        broker: broker === "other" ? customBroker.trim() : broker,
        name: name.trim(),
        kind: kind ?? accountKind,
        currency,
        initialBalance: Number(balance),
      });
      onCreated({ id: result.id, name: name.trim(), kind: kind ?? accountKind, archivedAt: null });
      setName("");
      setBalance("0");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account creation failed.");
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  };
  return (
    <form
      className={className ?? "space-y-3"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!saving) void create();
      }}
    >
      {showTitle && (
        <h3 className="text-sm font-medium">
          <I18nText text="Create account" />
        </h3>
      )}
      {!kind && (
        <div className="space-y-1">
          <Label htmlFor={`${fieldId}-kind`}>
            <I18nText text="Account type" />
          </Label>
          <select
            id={`${fieldId}-kind`}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={accountKind}
            disabled={saving}
            onChange={(event) => setAccountKind(event.target.value as "manual" | "import")}
          >
            <option value="manual">
              <I18nText text="Manual trades" />
            </option>
            <option value="import">
              <I18nText text="File import" />
            </option>
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldId}-broker`}>{t("Forex broker")}</Label>
        <select
          id={`${fieldId}-broker`}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={broker}
          disabled={saving}
          onChange={(e) => {
            setBroker(e.target.value);
            if (!name && e.target.value !== "other") setName(e.target.value);
          }}
        >
          <option value="">{t("No broker selected")}</option>
          {FOREX_BROKERS.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
          <option value="other">{t("Other broker")}</option>
        </select>
        {broker === "other" && (
          <Input
            aria-label={t("Broker name")}
            required
            maxLength={120}
            value={customBroker}
            onChange={(e) => setCustomBroker(e.target.value)}
            disabled={saving}
          />
        )}
        <p className="text-xs text-muted-foreground">
          {t(
            "Broker selection labels your journal. Use report import or manual entry; it does not enable automatic sync.",
          )}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`${fieldId}-name`}>
            <I18nText text="Account name" />
          </Label>
          <Input
            id={`${fieldId}-name`}
            autoFocus
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={saving}
            placeholder="Trading test account"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${fieldId}-currency`}>
            <I18nText text="Currency" />
          </Label>
          <CurrencyPicker
            id={`${fieldId}-currency`}
            value={currency}
            onChange={setCurrency}
            disabled={saving}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${fieldId}-balance`}>
            <I18nText text="Starting balance" />
          </Label>
          <Input
            id={`${fieldId}-balance`}
            required
            type="number"
            min="0"
            step="0.01"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            disabled={saving}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={
          saving ||
          !name.trim() ||
          !/^[A-Z]{3}$/.test(currency) ||
          !balance.trim() ||
          !Number.isFinite(Number(balance)) ||
          Number(balance) < 0
        }
      >
        {saving ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
