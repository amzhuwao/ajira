import Link from "next/link";
import { refreshStatsAction } from "@/lib/actions/admin";
import { processWithdrawalAction } from "@/lib/actions/payments";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";

export const metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  await requireRole("ADMIN");

  const [
    userCount,
    projectCount,
    fundedEscrows,
    openDisputes,
    pendingWithdrawals,
    users,
    escrows,
    disputes,
    withdrawals,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.escrow.count({ where: { status: "FUNDED" } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.escrow.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        project: { select: { title: true } },
        buyer: { select: { name: true } },
        seller: { select: { name: true } },
      },
    }),
    prisma.dispute.findMany({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
      include: { escrow: { include: { project: true } } },
      take: 20,
    }),
    prisma.withdrawalRequest.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
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
          <Link href="/dashboard/admin/financials" className="btn btn-secondary">Financials</Link>
          <Link href="/dashboard/admin/settings" className="btn btn-ghost">Settings</Link>
          <Link href="/dashboard/admin/audit" className="btn btn-ghost">Audit</Link>
          <form
            action={async () => {
              "use server";
              await refreshStatsAction();
            }}
          >
            <button className="btn btn-ghost" type="submit">Refresh seller stats</button>
          </form>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Users", userCount],
          ["Projects", projectCount],
          ["Funded escrows", fundedEscrows],
          ["Open disputes", openDisputes],
          ["Pending payouts", pendingWithdrawals],
        ].map(([label, value]) => (
          <div key={String(label)} className="panel">
            <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">{label}</div>
            <div className="font-display text-3xl">{value}</div>
          </div>
        ))}
      </div>

      <section id="withdrawals" className="mt-12">
        <h2 className="font-display text-2xl">Withdrawals</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Mark completed after sending Ecocash / bank payout outside Ajira.
        </p>
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
              {withdrawals.map((w) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="disputes" className="mt-12">
        <h2 className="font-display text-2xl">Open disputes</h2>
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
              {disputes.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/dashboard/disputes/${d.id}`} className="text-forest">
                      {d.escrow.project.title}
                    </Link>
                  </td>
                  <td>{d.status}</td>
                  <td>{formatDate(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="escrows" className="mt-12">
        <h2 className="font-display text-2xl">Recent escrows</h2>
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
        <h2 className="font-display text-2xl">Users</h2>
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
                  <td>{u.name}</td>
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
