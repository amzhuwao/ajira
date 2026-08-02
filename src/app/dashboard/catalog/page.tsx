import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ActionForm } from "@/components/ui/action-form";
import { TrustBadges } from "@/components/trust/badges";
import { orderServiceAction } from "@/lib/actions/commerce";
import { prisma } from "@/lib/prisma";
import { formatMoney, requireSession } from "@/lib/utils";

export const metadata = { title: "Service catalog" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category.trim() : "";
  const maxPrice = typeof sp.maxPrice === "string" ? Number(sp.maxPrice) : NaN;

  const where: Prisma.ServiceWhereInput = { status: "ACTIVE" };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) where.category = { contains: category, mode: "insensitive" };
  if (Number.isFinite(maxPrice) && maxPrice > 0) where.price = { lte: maxPrice };

  const services = await prisma.service.findMany({
    where,
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          kycVerified: true,
          statistics: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const canOrder = session.user.role === "BUYER" || session.user.role === "ADMIN";

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-4xl">Service catalog</h1>
      <p className="mt-2 text-ink-soft">
        Buy fixed packages instantly — no bidding required.
      </p>

      <form className="panel mt-6 grid gap-3 sm:grid-cols-3">
        <input className="input" name="q" placeholder="Search services" defaultValue={q} />
        <input className="input" name="category" placeholder="Category" defaultValue={category} />
        <input
          className="input"
          name="maxPrice"
          type="number"
          step="0.01"
          placeholder="Max price"
          defaultValue={Number.isFinite(maxPrice) ? String(maxPrice) : ""}
        />
        <button className="btn btn-primary sm:col-span-3 self-start" type="submit">
          Filter
        </button>
      </form>

      <div className="mt-8 space-y-4">
        {services.map((service) => (
          <div key={service.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">{service.title}</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  <Link href={`/dashboard/sellers/${service.seller.id}`} className="text-forest">
                    {service.seller.name}
                  </Link>
                  {service.category ? ` · ${service.category}` : ""} · {service.deliveryDays} days
                </p>
                <div className="mt-2">
                  <TrustBadges
                    kycVerified={service.seller.kycVerified}
                    statistics={service.seller.statistics}
                  />
                </div>
              </div>
              <div className="font-display text-2xl">{formatMoney(service.price)}</div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">{service.description}</p>
            {service.deliverables ? (
              <p className="mt-2 text-sm">
                <strong>Includes:</strong> {service.deliverables}
              </p>
            ) : null}
            {canOrder && service.sellerId !== session.user.id ? (
              <ActionForm action={orderServiceAction} className="mt-4 flex flex-col gap-2">
                <input type="hidden" name="serviceId" value={service.id} />
                <textarea
                  className="textarea"
                  name="notes"
                  placeholder="Optional notes for the seller"
                />
                <button className="btn btn-primary self-start" type="submit">
                  Order — {formatMoney(service.price)}
                </button>
              </ActionForm>
            ) : null}
          </div>
        ))}
        {services.length === 0 ? (
          <div className="panel text-ink-soft">No active services match.</div>
        ) : null}
      </div>
    </div>
  );
}
