import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: "About Ajira",
  description:
    "Ajira is a Zimbabwe-ready freelance marketplace with Paynow escrow, wallets, disputes, and protected payouts for buyers and sellers.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-line px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-display text-2xl">
            Ajira
          </Link>
          <Link href="/register" className="btn btn-primary">
            Get started
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl">About Ajira</h1>
        <div className="mt-8 space-y-5 text-ink-soft leading-relaxed">
          <p>
            Ajira is a freelance marketplace built for how work actually gets paid in Zimbabwe.
            Buyers post projects or order fixed service packages. Sellers bid with proposals or
            list catalog offerings. When both sides agree, funds move into Paynow-backed escrow —
            Ecocash, OneMoney, or web checkout — and stay protected until delivery is approved.
          </p>
          <p>
            Too many local gigs still rely on trust-only transfers: buyers worry about paying first,
            freelancers worry about never getting paid. Ajira replaces that ambiguity with a clear
            path: brief → proposal or catalog order → fund escrow → deliver (optionally by milestone)
            → approve → wallet credit → withdraw.
          </p>
          <h2 className="font-display text-2xl text-ink pt-4">What makes Ajira different</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Escrow that understands Zimbabwean payment rails via Paynow.</li>
            <li>Project messaging, milestones, disputes, and reviews in one place.</li>
            <li>Seller profiles with skills, services, ratings, and trust badges.</li>
            <li>Transparent platform fees shown at release — not hidden at checkout surprises.</li>
          </ul>
          <h2 className="font-display text-2xl text-ink pt-4">Who it is for</h2>
          <p>
            Startups and SMEs hiring designers, developers, writers, and marketers. Freelancers who
            want protected payouts and a professional presence. Agencies testing fixed-scope packages
            through the service catalog.
          </p>
          <h2 className="font-display text-2xl text-ink pt-4">Trust and safety</h2>
          <p>
            We support KYC for sellers when required, audit escrow state changes, and give both
            parties a dispute path with evidence uploads. Ads, if shown, follow our{" "}
            <Link href="/privacy" className="text-forest">
              Privacy Policy
            </Link>{" "}
            and Google publisher requirements. Marketplace rules live in our{" "}
            <Link href="/terms" className="text-forest">
              Terms of Service
            </Link>
            .
          </p>
          <p>
            Questions? Email{" "}
            <a href="mailto:info@ajira.online" className="text-forest">
              info@ajira.online
            </a>{" "}
            or visit{" "}
            <Link href="/contact" className="text-forest">
              Contact
            </Link>
            .
          </p>
          <h2 className="font-display text-2xl text-ink pt-4">Android app</h2>
          <p>
            Prefer the native experience? Install the Ajira companion for Android — buyer, seller,
            and admin flows with in-app Paynow checkout.
          </p>
          <p>
            <a href="/download" className="btn btn-primary inline-flex">
              Get Android app
            </a>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
