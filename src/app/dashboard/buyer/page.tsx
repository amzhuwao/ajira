import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";

export const metadata = { title: "Buyer dashboard" };

const COLUMNS = [
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "COMPLETED", label: "Completed" },
  { key: "DISPUTED", label: "Disputed" },
] as const;

export default async function BuyerDashboardPage() {
  const session = await requireRole("BUYER", "ADMIN");

  const projects = await prisma.project.findMany({
    where: { buyerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { bids: true } },
      escrow: true,
      acceptedBid: {
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              tagline: true,
              statistics: true,
              kycVerified: true,
            },
          },
        },
      },
      reviews: true,
    },
  });

  const favoriteRows = await prisma.favoriteSeller.findMany({
    where: { buyerId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          tagline: true,
          kycVerified: true,
          statistics: true,
        },
      },
    },
  });

  const favorites = favoriteRows.map((f) => ({
    id: f.seller.id,
    name: f.seller.name,
    tagline: f.seller.tagline,
    kycVerified: f.seller.kycVerified,
    jobs: f.seller.statistics?.completedJobs ?? 0,
    rating: Number(f.seller.statistics?.averageRating ?? 0),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Buyer overview</h1>
          <p className="mt-2 text-ink-soft">
            Track work on the board, fund escrow, and revisit trusted freelancers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/wallet" className="btn btn-secondary">
            Wallet
          </Link>
          <Link href="/dashboard/projects/new" className="btn btn-primary">
            Post a project
          </Link>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Pipeline</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = projects.filter((p) => p.status === col.key);
            return (
              <div key={col.key} className="rounded-2xl bg-sand/40 p-3 min-h-[180px]">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em]">{col.label}</h3>
                  <span className="badge">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((project) => (
                    <Link
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      className="block rounded-xl bg-panel p-3 shadow-sm hover:ring-1 hover:ring-forest/30"
                    >
                      <div className="font-semibold text-sm leading-snug">{project.title}</div>
                      <div className="mt-1 text-xs text-ink-soft">
                        {project._count.bids} bids · {formatMoney(project.budgetMin)}–{formatMoney(project.budgetMax)}
                      </div>
                      {project.escrow ? (
                        <div className="mt-1 text-xs text-forest">{project.escrow.status}</div>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {favorites.length > 0 ? (
        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">Favorite freelancers</h2>
              <p className="mt-1 text-sm text-ink-soft">Your saved shortlist.</p>
            </div>
            <Link href="/dashboard/favorites" className="text-sm text-forest">
              Manage favorites →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((seller) => (
              <Link key={seller.id} href={`/dashboard/sellers/${seller.id}`} className="panel block">
                <div className="font-semibold">{seller.name}</div>
                <div className="text-sm text-ink-soft">{seller.tagline || "Ajira seller"}</div>
                <div className="mt-2 text-sm">
                  {seller.rating.toFixed(1)}★ · {seller.jobs} jobs
                  {seller.kycVerified ? " · KYC" : ""}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-10 panel">
          <h2 className="font-display text-2xl">Find talent</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Browse sellers and save favorites for your next hire.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard/talent" className="btn btn-primary">
              Browse talent
            </Link>
            <Link href="/dashboard/catalog" className="btn btn-secondary">
              Service catalog
            </Link>
          </div>
        </section>
      )}

      <section id="projects" className="mt-10">
        <h2 className="font-display text-2xl">All projects</h2>
        <div className="table-wrap mt-4 panel">
          <table className="data">
            <thead>
              <tr>
                <th>Project</th>
                <th>Budget</th>
                <th>Bids</th>
                <th>Status</th>
                <th>Escrow</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-ink-soft">
                    No projects yet. Post your first brief to get bids.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="font-semibold text-forest"
                      >
                        {project.title}
                      </Link>
                      <div className="text-xs text-ink-soft">
                        {formatDate(project.createdAt)} · {project.timeline}
                      </div>
                    </td>
                    <td>
                      {formatMoney(Number(project.budgetMin))} –{" "}
                      {formatMoney(Number(project.budgetMax))}
                    </td>
                    <td>{project._count.bids}</td>
                    <td>
                      <span className="badge">{project.status}</span>
                    </td>
                    <td>
                      {project.escrow ? (
                        <Link
                          href={`/dashboard/escrow/${project.escrow.id}`}
                          className="text-forest underline-offset-2 hover:underline"
                        >
                          {project.escrow.status}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
