import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Freelance services",
  description:
    "Browse fixed-price freelance service packages on Ajira — design, development, writing, and more with escrow-backed checkout.",
};

export default async function PublicServicesPage() {
  const session = await auth();
  const services = await prisma.service.findMany({
    where: { status: "ACTIVE" },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          kycVerified: true,
          tagline: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-line px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link href="/" className="font-display text-2xl">
            Ajira
          </Link>
          <div className="flex flex-wrap gap-2">
            {session?.user ? (
              <Link href="/dashboard/catalog" className="btn btn-primary">
                Order in dashboard
              </Link>
            ) : (
              <Link href="/register?role=BUYER" className="btn btn-primary">
                Sign up to order
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-display text-4xl">Service catalog</h1>
        <p className="mt-3 max-w-2xl text-ink-soft leading-relaxed">
          Fixed packages from verified freelancers. Ordering creates an escrow-backed project so
          payment stays protected until delivery. Browse freely — checkout requires an Ajira
          account.
        </p>

        <div className="mt-10 space-y-4">
          {services.length === 0 ? (
            <div className="panel text-ink-soft">
              No public services yet.{" "}
              <Link href="/register?role=SELLER" className="text-forest">
                Sellers can list packages
              </Link>{" "}
              from their dashboard.
            </div>
          ) : (
            services.map((service) => (
              <article key={service.id} className="panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl">{service.title}</h2>
                    <p className="mt-1 text-sm text-ink-soft">
                      {service.seller.name}
                      {service.seller.kycVerified ? " · ID verified" : ""}
                      {service.category ? ` · ${service.category}` : ""} · {service.deliveryDays}{" "}
                      days
                    </p>
                  </div>
                  <div className="font-display text-2xl">{formatMoney(service.price)}</div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">
                  {service.description}
                </p>
                {service.deliverables ? (
                  <p className="mt-2 text-sm">
                    <strong>Includes:</strong> {service.deliverables}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
