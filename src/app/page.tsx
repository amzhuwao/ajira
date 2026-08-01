import Link from "next/link";
import { auth } from "@/lib/auth";
import { dashboardPathForRole } from "@/lib/utils";

export default async function HomePage() {
  const session = await auth();
  const dash = session?.user ? dashboardPathForRole(session.user.role) : null;

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="absolute inset-x-0 top-0 z-20">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-2xl tracking-tight text-cream">Ajira</span>
          <div className="flex items-center gap-3 text-sm text-cream">
            {dash ? (
              <Link href={dash} className="btn btn-ghost">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:inline-block opacity-90 hover:opacity-100">
                  Log in
                </Link>
                <Link href="/register" className="btn btn-ghost">
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="hero-atmosphere animate-soft-pan" aria-hidden />
        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-6 pb-16 pt-28 sm:justify-center sm:pb-24">
          <p className="animate-fade-up font-display text-5xl text-cream sm:text-7xl md:text-8xl">
            Ajira
          </p>
          <h1 className="animate-fade-up delay-1 mt-4 max-w-2xl font-display text-3xl leading-tight text-cream sm:text-5xl">
            Hire with confidence. Get paid with clarity.
          </h1>
          <p className="animate-fade-up delay-2 mt-5 max-w-xl text-base text-sand sm:text-lg">
            A Zimbabwe-ready freelance marketplace with Paynow escrow — Ecocash,
            OneMoney, and card — so work stays protected until delivery.
          </p>
          <div className="animate-fade-up delay-3 mt-8 flex flex-wrap gap-3">
            <Link href="/register?role=BUYER" className="btn btn-primary">
              Post a project
            </Link>
            <Link href="/register?role=SELLER" className="btn btn-ghost">
              Find work
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl sm:text-4xl">How Ajira works</h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          One clear path from brief to payout — escrow holds funds until the buyer
          approves delivered work.
        </p>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Agree on the work",
              copy: "Buyers post projects. Sellers bid. Accept a bid to open escrow.",
            },
            {
              step: "02",
              title: "Fund with Paynow",
              copy: "Pay via web checkout or mobile money. Funds stay secured until delivery.",
            },
            {
              step: "03",
              title: "Approve and release",
              copy: "Seller delivers, buyer approves, wallet is credited. Withdraw when ready.",
            },
          ].map((item) => (
            <li key={item.step} className="border-t border-line pt-5">
              <div className="text-sm font-semibold text-forest">{item.step}</div>
              <h3 className="mt-2 font-display text-2xl">{item.title}</h3>
              <p className="mt-2 text-ink-soft">{item.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-line px-6 py-10 text-sm text-ink-soft">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-lg text-ink">Ajira</span>
          <span>Escrow marketplace · Powered by Paynow</span>
        </div>
      </footer>
    </div>
  );
}
