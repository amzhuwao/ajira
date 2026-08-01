import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { processWithdrawalAction } from "@/lib/actions/payments";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function AdminWithdrawalsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  const withdrawals = await prisma.withdrawalRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div>
      <h1 className="font-display text-3xl">Withdrawals</h1>
      <p className="mt-1 text-ink-soft">
        Pay sellers manually via Ecocash/bank, then mark completed.
      </p>
      <div className="mt-8 space-y-3">
        {withdrawals.map((w) => (
          <div key={w.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {formatMoney(w.amount)} · {w.user.name}
                </div>
                <div className="text-sm text-ink-soft">
                  {w.method} → {w.destination} · {formatDate(w.createdAt)}
                </div>
              </div>
              <span className="badge">{w.status}</span>
            </div>
            {w.status === "PENDING" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <form
                  action={async () => {
                    "use server";
                    await processWithdrawalAction(w.id, "APPROVED");
                  }}
                >
                  <button type="submit" className="btn btn-ghost">
                    Approve
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await processWithdrawalAction(w.id, "COMPLETED", "Paid out manually");
                  }}
                >
                  <button type="submit" className="btn btn-primary">
                    Mark completed
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await processWithdrawalAction(w.id, "REJECTED", "Rejected by admin");
                  }}
                >
                  <button type="submit" className="btn btn-ghost">
                    Reject (refund wallet)
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
        {withdrawals.length === 0 && (
          <div className="card text-ink-soft">No withdrawal requests.</div>
        )}
      </div>
      <Link href="/dashboard/admin" className="mt-6 inline-block text-forest">
        ← Admin home
      </Link>
    </div>
  );
}
