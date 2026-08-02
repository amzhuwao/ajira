import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { DEFAULT_TERMS_OF_SERVICE } from "@/lib/legal";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing use of the Ajira freelance marketplace, escrow, payments, and prohibited content.",
  robots: { index: true, follow: true },
};

export default async function TermsPage() {
  const stored = await getSetting("tos_text", "");
  const text =
    stored && stored.length > 200 && !stored.startsWith("By using Ajira you agree")
      ? stored
      : DEFAULT_TERMS_OF_SERVICE;

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-line px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-display text-2xl">
            Ajira
          </Link>
          <Link href="/privacy" className="text-sm text-forest">
            Privacy Policy
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl">Terms of Service</h1>
        <div className="mt-8 space-y-4 whitespace-pre-wrap text-ink-soft leading-relaxed">
          {text}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
