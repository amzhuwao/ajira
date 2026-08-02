import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";
import type { PaymentChannel, PaymentStatus, Prisma } from "@prisma/client";

export const metadata = { title: "Admin payments" };

const STATUSES: Array<PaymentStatus | "ALL"> = [
  "ALL",
  "CREATED",
  "SENT",
  "PAID",
  "CANCELLED",
  "FAILED",
];

const CHANNELS: Array<PaymentChannel | "ALL"> = ["ALL", "WEB", "ECOCASH", "ONEMONEY"];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; channel?: string; q?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const status = (params.status?.toUpperCase() || "ALL") as PaymentStatus | "ALL";
  const channel = (params.channel?.toUpperCase() || "ALL") as PaymentChannel | "ALL";
  const q = params.q?.trim() ?? "";

  const where: Prisma.EscrowPaymentWhereInput = {};
  if (status !== "ALL") where.status = status;
  if (channel !== "ALL") where.channel = channel;
  if (q) {
    where.OR = [
      { merchantReference: { contains: q, mode: "insensitive" } },
      { paynowReference: { contains: q, mode: "insensitive" } },
      { escrow: { project: { title: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [payments, byStatus] = await Promise.all([
    prisma.escrowPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        escrow: {
          include: {
            project: { select: { title: true } },
            buyer: { select: { name: true } },
          },
        },
      },
    }),
    prisma.escrowPayment.groupBy({
      by: ["status"],
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  const statusMap = Object.fromEntries(
    byStatus.map((s) => [s.status, { count: s._count, sum: Number(s._sum.amount ?? 0) }]),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-4xl">Payments</h1>
      <p className="mt-2 text-ink-soft">
        Paynow escrow funding attempts — watch for stuck SENT or FAILED payments.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STATUSES.filter((s) => s !== "ALL").map((s) => (
          <div key={s} className="panel">
            <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">{s}</div>
            <div className="font-display text-2xl">{statusMap[s]?.count ?? 0}</div>
            <div className="text-sm text-ink-soft">
              {formatMoney(statusMap[s]?.sum ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <form className="mt-8 flex flex-wrap gap-2" method="get">
        <input
          className="input min-w-[200px] flex-1"
          name="q"
          defaultValue={q}
          placeholder="Reference or project"
        />
        <select className="input" name="status" defaultValue={status}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="input" name="channel" defaultValue={channel}>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>

      <div className="table-wrap panel mt-6">
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Project</th>
              <th>Channel</th>
              <th>Amount</th>
              <th>Status</th>
              <th>References</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-ink-soft">
                  No payments match.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{formatDate(p.createdAt)}</td>
                  <td>
                    <Link href={`/dashboard/escrow/${p.escrowId}`} className="text-forest">
                      {p.escrow.project.title}
                    </Link>
                    <div className="text-xs text-ink-soft">{p.escrow.buyer.name}</div>
                  </td>
                  <td>
                    {p.channel}
                    {p.phone ? <div className="text-xs text-ink-soft">{p.phone}</div> : null}
                  </td>
                  <td>{formatMoney(p.amount)}</td>
                  <td>
                    <span className="badge">{p.status}</span>
                    {p.rawStatus ? (
                      <div className="text-xs text-ink-soft">{p.rawStatus}</div>
                    ) : null}
                  </td>
                  <td className="text-xs">
                    <div className="truncate max-w-[180px]" title={p.merchantReference}>
                      M: {p.merchantReference}
                    </div>
                    {p.paynowReference ? (
                      <div className="truncate max-w-[180px]" title={p.paynowReference}>
                        P: {p.paynowReference}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
