import Link from "next/link";
import { refreshStatsAction } from "@/lib/actions/admin";
import { processWithdrawalAction } from "@/lib/actions/payments";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";

export const metadata = { title: "Admin" };

const TOOLS = [
  { href: "/dashboard/admin/users", title: "Users", desc: "Roles, status, KYC" },
  { href: "/dashboard/admin/projects", title: "Projects", desc: "Cancel or reassign" },
  { href: "/dashboard/admin/escrows", title: "Escrows", desc: "Release, refund, hold" },
  { href: "/dashboard/admin/disputes", title: "Disputes", desc: "Triage and resolve" },
  { href: "/dashboard/admin/financials", title: "Financials", desc: "Fees and wallets" },
  { href: "/dashboard/admin/payments", title: "Payments", desc: "Paynow attempts" },
  { href: "/dashboard/admin/gateway", title: "Payment gateway", desc: "Credentials and tests" },
  { href: "/dashboard/admin/withdrawals", title: "Withdrawals", desc: "Seller payouts" },
  { href: "/dashboard/admin/settings", title: "Settings", desc: "Fees and policy" },
  { href: "/dashboard/admin/audit", title: "Audit logs", desc: "Admin activity" },
] as const;

export default async function AdminDashboardPage() {
  await requireRole("ADMIN");

  const [
    userCount,
    buyerCount,
    sellerCount,
    projectCount,
    openProjects,
    fundedEscrows,
    releasedEscrows,
    openDisputes,
    pendingWithdrawals,
    fundedVolume,
    users,
    escrows,
    disputes,
    withdrawals,
    recentActivity,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "BUYER" } }),
    prisma.user.count({ where: { role: "SELLER" } }),
    prisma.project.count(),
    prisma.project.count({ where: { status: "OPEN" } }),
    prisma.escrow.count({ where: { status: "FUNDED" } }),
    prisma.escrow.count({ where: { status: "RELEASED" } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    prisma.escrow.aggregate({
      where: { status: { in: ["FUNDED", "RELEASE_REQUESTED", "DISPUTED"] } },
      _sum: { amount: true },
    }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.escrow.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: {
        project: { select: { title: true } },
        buyer: { select: { name: true } },
        seller: { select: { name: true } },
      },
    }),
    prisma.dispute.findMany({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
      include: { escrow: { include: { project: true } } },
      take: 12,
    }),
    prisma.withdrawalRequest.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.adminActivityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { admin: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Admin overview</h1>
          <p className="mt-2 text-ink-soft">
            Platform health, escrow oversight, withdrawals, and disputes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/admin/financials" className="btn btn-secondary">
            Financials
          </Link>
          <Link href="/dashboard/admin/settings" className="btn btn-ghost">
            Settings
          </Link>
          <Link href="/dashboard/admin/audit" className="btn btn-ghost">
            Audit
          </Link>
          <form
            action={async () => {
              "use server";
              await refreshStatsAction();
            }}
          >
            <button className="btn btn-ghost" type="submit">
              Refresh seller stats
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {[
          ["Users", userCount, `${buyerCount} buyers · ${sellerCount} sellers`],
          ["Projects", projectCount, `${openProjects} open`],
          ["Funded escrows", fundedEscrows, formatMoney(fundedVolume._sum.amount ?? 0) + " held"],
          ["Released", releasedEscrows, "completed escrows"],
          ["Open disputes", openDisputes, `${pendingWithdrawals} pending payouts`],
        ].map(([label, value, hint]) => (
          <div key={String(label)} className="panel">
            <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">{label}</div>
            <div className="font-display text-3xl">{value}</div>
            <div className="mt-1 text-sm text-ink-soft">{hint}</div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Admin tools</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="panel block border-l-4 border-l-forest transition hover:-translate-y-0.5"
            >
              <h3 className="font-semibold">{tool.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{tool.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Recent activity</h2>
          <Link href="/dashboard/admin/audit" className="text-sm text-forest">
            View all
          </Link>
        </div>
        <div className="table-wrap mt-4 panel">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-ink-soft">
                    No admin activity yet.
                  </td>
                </tr>
              ) : (
                recentActivity.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td>{log.admin.name}</td>
                    <td>
                      <span className="badge">{log.action}</span>
                    </td>
                    <td>{log.summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="withdrawals" className="mt-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Withdrawals</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Mark completed after sending Ecocash / bank payout outside Ajira.
            </p>
          </div>
          <Link href="/dashboard/admin/withdrawals" className="text-sm text-forest">
            Full queue
          </Link>
        </div>
        <div className="table-wrap mt-4 panel">
          <table className="data">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-ink-soft">
                    No pending withdrawals.
                  </td>
                </tr>
              ) : (
                withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td>
                      {w.user.name}
                      <div className="text-xs text-ink-soft">{w.user.email}</div>
                    </td>
                    <td>{formatMoney(Number(w.amount))}</td>
                    <td>{w.method}</td>
                    <td>{w.destination}</td>
                    <td>
                      <span className="badge">{w.status}</span>
                    </td>
                    <td className="space-x-2">
                      {w.status === "PENDING" ? (
                        <>
                          <form
                            className="inline"
                            action={async () => {
                              "use server";
                              await processWithdrawalAction(w.id, "APPROVED");
                            }}
                          >
                            <button className="text-forest text-sm" type="submit">
                              Approve
                            </button>
                          </form>
                          <form
                            className="inline"
                            action={async () => {
                              "use server";
                              await processWithdrawalAction(w.id, "REJECTED", "Rejected by admin");
                            }}
                          >
                            <button className="text-danger text-sm" type="submit">
                              Reject
                            </button>
                          </form>
                        </>
                      ) : null}
                      {w.status === "APPROVED" ? (
                        <form
                          className="inline"
                          action={async () => {
                            "use server";
                            await processWithdrawalAction(w.id, "COMPLETED", "Paid out");
                          }}
                        >
                          <button className="text-forest text-sm" type="submit">
                            Mark paid
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="disputes" className="mt-12">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Open disputes</h2>
          <Link href="/dashboard/admin/disputes" className="text-sm text-forest">
            Dispute hub
          </Link>
        </div>
        <div className="table-wrap mt-4 panel">
          <table className="data">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {disputes.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-ink-soft">
                    No open disputes.
                  </td>
                </tr>
              ) : (
                disputes.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/dashboard/disputes/${d.id}`} className="text-forest">
                        {d.escrow.project.title}
                      </Link>
                    </td>
                    <td>{d.status}</td>
                    <td>{formatDate(d.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="escrows" className="mt-12">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Recent escrows</h2>
          <Link href="/dashboard/admin/escrows" className="text-sm text-forest">
            All escrows
          </Link>
        </div>
        <div className="table-wrap mt-4 panel">
          <table className="data">
            <thead>
              <tr>
                <th>Project</th>
                <th>Parties</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {escrows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/dashboard/escrow/${e.id}`} className="text-forest">
                      {e.project.title}
                    </Link>
                  </td>
                  <td className="text-sm">
                    {e.buyer.name} → {e.seller.name}
                  </td>
                  <td>{formatMoney(Number(e.amount))}</td>
                  <td>
                    <span className="badge">{e.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="users" className="mt-12">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Recent users</h2>
          <Link href="/dashboard/admin/users" className="text-sm text-forest">
            Manage users
          </Link>
        </div>
        <div className="table-wrap mt-4 panel">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/dashboard/admin/users/${u.id}`} className="text-forest">
                      {u.name}
                    </Link>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
