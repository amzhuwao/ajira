import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Ajira support for account, escrow, and partnership questions.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-line px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-display text-2xl">
            Ajira
          </Link>
          <Link href="/about" className="text-sm text-forest">
            About
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl">Contact</h1>
        <p className="mt-4 text-ink-soft leading-relaxed">
          We respond to account, escrow, and partnership questions during business hours. Include
          your account email and any project or escrow reference so we can help faster.
        </p>
        <div className="panel mt-8 space-y-3">
          <p>
            <strong>Email:</strong>{" "}
            <a href="mailto:info@ajira.online" className="text-forest">
              info@ajira.online
            </a>
          </p>
          <p>
            <strong>Privacy requests:</strong> use the same address with subject “Privacy request”.
          </p>
          <p>
            <strong>Policies:</strong>{" "}
            <Link href="/privacy" className="text-forest">
              Privacy Policy
            </Link>
            {" · "}
            <Link href="/terms" className="text-forest">
              Terms of Service
            </Link>
          </p>
        </div>
        <p className="mt-8 text-sm text-ink-soft">
          For urgent payment issues on a funded escrow, open a dispute from your dashboard so both
          parties and admins have a shared audit trail.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
