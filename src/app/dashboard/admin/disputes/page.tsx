import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";
import type { DisputeStatus, Prisma } from "@prisma/client";

export const metadata = { title: "Admin disputes" };

const STATUS_OPTIONS: Array<DisputeStatus | "OPEN_ALL" | "ALL"> = [
  "OPEN_ALL",
  "ALL",
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED_RELEASE",
  "RESOLVED_REFUND",
  "RESOLVED_SPLIT",
  "CLOSED",
];

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; sort?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const statusFilter = (params.status || "OPEN_ALL").toUpperCase();
  const q = params.q?.trim() ?? "";
  const sort = params.sort || "newest";

  const where: Prisma.DisputeWhereInput = {};
  if (statusFilter === "OPEN_ALL") {
    where.status = { in: ["OPEN", "UNDER_REVIEW"] };
  } else if (statusFilter !== "ALL") {
    where.status = statusFilter as DisputeStatus;
  }
  if (q) {
    where.OR = [
      { escrow: { project: { title: { contains: q, mode: "insensitive" } } } },
      { openedBy: { name: { contains: q, mode: "insensitive" } } },
      { reason: { contains: q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.DisputeOrderByWithRelationInput =
    sort === "oldest"
      ? { createdAt: "asc" }
      : sort === "amount_high"
        ? { escrow: { amount: "desc" } }
        : sort === "amount_low"
          ? { escrow: { amount: "asc" } }
          : { createdAt: "desc" };

  const [
    disputes,
    openCount,
    underReviewCount,
    resolvedRelease,
    resolvedRefund,
    resolvedSplit,
    openAmounts,
  ] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy,
      take: 50,
      include: {
        escrow: {
          include: {
            project: { select: { title: true } },
            buyer: { select: { name: true } },
            seller: { select: { name: true } },
          },
        },
        openedBy: { select: { name: true } },
        _count: { select: { messages: true, evidence: true } },
      },
    }),
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.dispute.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.dispute.count({ where: { status: "RESOLVED_RELEASE" } }),
    prisma.dispute.count({ where: { status: "RESOLVED_REFUND" } }),
    prisma.dispute.count({ where: { status: "RESOLVED_SPLIT" } }),
    prisma.dispute.findMany({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
      select: { escrow: { select: { amount: true } } },
    }),
  ]);

  const amounts = openAmounts.map((d) => Number(d.escrow.amount));
  const avgAmount =
    amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
  const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Disputes</h1>
          <p className="mt-2 text-ink-soft">Queue, triage, and resolve escrow disputes.</p>
        </div>
        <Link href="/dashboard/disputes" className="btn btn-ghost">
          Shared disputes view
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Open</div>
          <div className="font-display text-3xl">{openCount}</div>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Under review</div>
          <div className="font-display text-3xl">{underReviewCount}</div>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Avg open amount</div>
          <div className="font-display text-3xl">{formatMoney(avgAmount)}</div>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Max open amount</div>
          <div className="font-display text-3xl">{formatMoney(maxAmount)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="panel text-sm">
          Resolved → seller: <strong>{resolvedRelease}</strong>
        </div>
        <div className="panel text-sm">
          Resolved → buyer: <strong>{resolvedRefund}</strong>
        </div>
        <div className="panel text-sm">
          Split: <strong>{resolvedSplit}</strong>
        </div>
      </div>

      <form className="mt-8 flex flex-wrap gap-2" method="get">
        <input
          className="input min-w-[200px] flex-1"
          name="q"
          defaultValue={q}
          placeholder="Search project, opener, reason"
        />
        <select className="input" name="status" defaultValue={statusFilter}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "OPEN_ALL" ? "Open + under review" : s}
            </option>
          ))}
        </select>
        <select className="input" name="sort" defaultValue={sort}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="amount_high">Amount high</option>
          <option value="amount_low">Amount low</option>
        </select>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>

      <div className="table-wrap panel mt-6">
        <table className="data">
          <thead>
            <tr>
              <th>Project</th>
              <th>Parties</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Activity</th>
              <th>Opened</th>
            </tr>
          </thead>
          <tbody>
            {disputes.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-ink-soft">
                  No disputes match.
                </td>
              </tr>
            ) : (
              disputes.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/dashboard/disputes/${d.id}`} className="text-forest font-medium">
                      {d.escrow.project.title}
                    </Link>
                    <div className="text-xs text-ink-soft line-clamp-1">{d.reason}</div>
                  </td>
                  <td className="text-sm">
                    {d.escrow.buyer.name} → {d.escrow.seller.name}
                    <div className="text-xs text-ink-soft">Opened by {d.openedBy.name}</div>
                  </td>
                  <td>{formatMoney(d.escrow.amount)}</td>
                  <td>
                    <span className="badge">{d.status}</span>
                  </td>
                  <td className="text-sm text-ink-soft">
                    {d._count.messages} msgs · {d._count.evidence} files
                  </td>
                  <td className="whitespace-nowrap">{formatDate(d.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
