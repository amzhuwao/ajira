import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: "How Ajira works",
  description:
    "Step-by-step: post or order work, fund Paynow escrow, deliver by milestone, approve, and withdraw earnings on Ajira.",
};

const steps = [
  {
    title: "Create an account",
    body: "Register as a buyer to hire, or as a seller to bid and list services. Keep your email and phone accurate for Paynow mobile money.",
  },
  {
    title: "Post a project or browse the catalog",
    body: "Buyers describe scope, budget, and timeline — optionally with screening questions. Or order a fixed package from the public service catalog.",
  },
  {
    title: "Review proposals or invite talent",
    body: "Sellers submit cover letters, portfolios, and delivery estimates. Buyers can invite freelancers from profiles and save favorites.",
  },
  {
    title: "Accept and fund escrow",
    body: "Accepting a bid (or placing a catalog order) opens escrow. Pay with Paynow web checkout, Ecocash, or OneMoney. Funds are held until release.",
  },
  {
    title: "Collaborate and deliver",
    body: "Use project messaging for Q&A and files. Split longer jobs into milestones. Sellers mark delivery when a phase is ready.",
  },
  {
    title: "Approve, release, withdraw",
    body: "Buyers approve to release funds to the seller wallet (platform commission applies). Sellers request withdrawals. Disputes are available on funded escrows.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-line px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-display text-2xl">
            Ajira
          </Link>
          <Link href="/register" className="btn btn-primary">
            Join Ajira
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl">How Ajira works</h1>
        <p className="mt-4 text-ink-soft leading-relaxed">
          Ajira keeps freelance work clear from brief to payout. Escrow is the core: money moves
          only when both sides have a shared record of what was agreed and delivered.
        </p>
        <ol className="mt-10 space-y-8">
          {steps.map((step, i) => (
            <li key={step.title} className="border-t border-line pt-6">
              <div className="text-sm font-semibold text-forest">
                Step {String(i + 1).padStart(2, "0")}
              </div>
              <h2 className="mt-2 font-display text-2xl">{step.title}</h2>
              <p className="mt-2 text-ink-soft leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/services" className="btn btn-secondary">
            Browse services
          </Link>
          <Link href="/register?role=BUYER" className="btn btn-primary">
            Post a project
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
