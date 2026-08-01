import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";

export const metadata = { title: "Seller dashboard" };

export default async function SellerDashboardPage() {
  const session = await requireRole("SELLER", "ADMIN");

  const [openProjects, myBids, wallet] = await Promise.all([
    prisma.project.findMany({
      where: { status: ProjectStatus.OPEN },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        buyer: { select: { name: true } },
        _count: { select: { bids: true } },
      },
    }),
    prisma.bid.findMany({
      where: { sellerId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { project: true, escrow: true },
    }),
    prisma.sellerWallet.findUnique({ where: { userId: session.user.id } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Seller overview</h1>
          <p className="mt-2 text-ink-soft">
            Browse open projects, bid, deliver, and manage your wallet.
          </p>
        </div>
        <div className="panel min-w-[200px]">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">
            Wallet balance
          </div>
          <div className="mt-1 font-display text-3xl">
            {formatMoney(Number(wallet?.balance ?? 0))}
          </div>
          <Link href="/dashboard/wallet" className="mt-2 inline-block text-sm text-forest">
            Manage wallet →
          </Link>
        </div>
      </div>

      <section id="browse" className="mt-10">
        <h2 className="font-display text-2xl">Open projects</h2>
        <div className="table-wrap mt-4 panel">
          <table className="data">
            <thead>
              <tr>
                <th>Project</th>
                <th>Buyer</th>
                <th>Budget</th>
                <th>Bids</th>
              </tr>
            </thead>
            <tbody>
              {openProjects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="font-semibold text-forest"
                    >
                      {project.title}
                    </Link>
                    <div className="text-xs text-ink-soft">
                      {formatDate(project.createdAt)}
                    </div>
                  </td>
                  <td>{project.buyer.name}</td>
                  <td>
                    {formatMoney(Number(project.budgetMin))} –{" "}
                    {formatMoney(Number(project.budgetMax))}
                  </td>
                  <td>{project._count.bids}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Your bids</h2>
        <div className="table-wrap mt-4 panel">
          <table className="data">
            <thead>
              <tr>
                <th>Project</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Escrow</th>
              </tr>
            </thead>
            <tbody>
              {myBids.map((bid) => (
                <tr key={bid.id}>
                  <td>
                    <Link href={`/dashboard/projects/${bid.projectId}`} className="text-forest">
                      {bid.project.title}
                    </Link>
                  </td>
                  <td>{formatMoney(Number(bid.amount))}</td>
                  <td>
                    <span className="badge">{bid.status}</span>
                  </td>
                  <td>
                    {bid.escrow ? (
                      <Link href={`/dashboard/escrow/${bid.escrow.id}`}>{bid.escrow.status}</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
