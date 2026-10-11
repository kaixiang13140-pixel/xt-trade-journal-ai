"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { translateUi } from "@/lib/i18n/zh";
import { Button } from "./ui/button";

type Locale = "en" | "zh";
const LanguageContext = createContext({
  locale: "en" as Locale,
  setLocale: (_locale: Locale) => {},
  t: (text: string) => text,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("xt-language");
      if (saved === "zh" || saved === "en") setLocale(saved);
      else if (navigator.language.toLowerCase().startsWith("zh")) setLocale("zh");
    } catch {}
    const sync = (event: StorageEvent) => {
      if (event.key === "xt-language" && (event.newValue === "zh" || event.newValue === "en"))
        setLocale(event.newValue);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-Hans" : "en";
  }, [locale]);
  const choose = (value: Locale) => {
    setLocale(value);
    try {
      localStorage.setItem("xt-language", value);
    } catch {}
  };
  return (
    <LanguageContext.Provider
      value={{ locale, setLocale: choose, t: (text) => translateUi(text, locale) }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
export function I18nText({ text }: { text: string }) {
  return <>{useLanguage().t(text)}</>;
}
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={compact ? "h-8 shrink-0 px-2" : "w-full justify-start"}
      onClick={() => setLocale(locale === "en" ? "zh" : "en")}
      aria-label={locale === "en" ? "切换中文" : "Switch to English"}
    >
      {locale === "en" ? "中文" : compact ? "EN" : "English"}
    </Button>
  );
}
