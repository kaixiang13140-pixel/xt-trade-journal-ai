"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "1. Set your timezone",
    body: "Choose your local display timezone. For Malaysia, use Asia/Kuala_Lumpur. Your report import timezone should follow the broker statement.",
    href: "/settings#general",
    action: "Open settings",
  },
  {
    title: "2. Add your trading records",
    body: "Import a broker report, or create a manual account and enter your trades. Keep different trading accounts separate.",
    href: "/import",
    action: "Open import",
  },
  {
    title: "3. Review and back up",
    body: "Use the calendar and daily journal to review your trades. Download a backup from Settings regularly.",
    href: "/calendar",
    action: "Open calendar",
  },
];
export default function HelpPage() {
  const { t } = useLanguage();
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("Getting started")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Record trades. Review decisions. Build better habits.")}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {steps.map((step) => (
          <Card key={step.title} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">{t(step.title)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{t(step.body)}</p>
              <Button variant="outline" asChild>
                <Link href={step.href}>{t(step.action)}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("How does MT5 work?")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(
                "MT5: import an HTML or CSV history report. Automatic MT5 sync is not available yet.",
              )}
            </p>
            <Button asChild variant="outline">
              <Link href="/import">{t("Open import")}</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("Phone and tablet")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(
                "Open the same hosted HTTPS address in your browser and sign in with the same email. Your local computer address is not a public website.",
              )}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("About AI features")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(
              "Configure your own AI provider and API key in Settings. Provider usage may cost money; journal browsing does not require an AI key.",
            )}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
