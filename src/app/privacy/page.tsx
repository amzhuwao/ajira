import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { DEFAULT_PRIVACY_POLICY } from "@/lib/legal";
import { SiteFooter } from "@/components/layout/site-footer";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Ajira collects, uses, and shares account, payment, and advertising-related data. Includes Google AdSense cookie disclosures.",
  robots: { index: true, follow: true },
};

export default async function PrivacyPage() {
  const stored = await getSetting("privacy_text", "");
  const text =
    stored && stored.length > 200 && !stored.startsWith("Ajira processes account")
      ? stored
      : DEFAULT_PRIVACY_POLICY;

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-line px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-display text-2xl">
            Ajira
          </Link>
          <Link href="/terms" className="text-sm text-forest">
            Terms of Service
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl">Privacy Policy</h1>
        <div className="prose-legal mt-8 space-y-4 whitespace-pre-wrap text-ink-soft leading-relaxed">
          {text}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
