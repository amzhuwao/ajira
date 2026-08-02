import {
  ensureSellerWalletsAction,
  walletBackfillAction,
} from "@/lib/actions/admin";
import { prisma } from "@/lib/prisma";
import { formatMoney, requireRole } from "@/lib/utils";

export const metadata = { title: "Financials" };

export default async function AdminFinancialsPage() {
  await requireRole("ADMIN");

  const [released, fees, withdrawals, wallets] = await Promise.all([
    prisma.escrow.aggregate({
      where: { status: "RELEASED" },
      _sum: { amount: true, feeAmount: true },
      _count: true,
    }),
    prisma.walletTransaction.aggregate({
      where: { type: "PLATFORM_FEE" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.withdrawalRequest.groupBy({
      by: ["status"],
      _sum: { amount: true },
      _count: true,
    }),
    prisma.sellerWallet.aggregate({
      _sum: { balance: true },
      _count: true,
    }),
  ]);

  const withdrawalMap = Object.fromEntries(
    withdrawals.map((w) => [w.status, { sum: Number(w._sum.amount ?? 0), count: w._count }]),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-4xl">Financials</h1>
      <p className="mt-2 text-ink-soft">Releases, fees, withdrawals, and seller balances.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Released volume</div>
          <div className="mt-1 font-display text-3xl">
            {formatMoney(released._sum.amount ?? 0)}
          </div>
          <div className="text-sm text-ink-soft">{released._count} escrows</div>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Platform fees</div>
          <div className="mt-1 font-display text-3xl">
            {formatMoney(fees._sum.amount ?? released._sum.feeAmount ?? 0)}
          </div>
          <div className="text-sm text-ink-soft">{fees._count} fee records</div>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Pending withdrawals</div>
          <div className="mt-1 font-display text-3xl">
            {formatMoney(withdrawalMap.PENDING?.sum ?? 0)}
          </div>
          <div className="text-sm text-ink-soft">{withdrawalMap.PENDING?.count ?? 0} requests</div>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Seller balances</div>
          <div className="mt-1 font-display text-3xl">
            {formatMoney(wallets._sum.balance ?? 0)}
          </div>
          <div className="text-sm text-ink-soft">{wallets._count} wallets</div>
        </div>
      </div>

      <section className="panel mt-8">
        <h2 className="font-display text-2xl">Withdrawal breakdown</h2>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {["PENDING", "APPROVED", "COMPLETED", "REJECTED"].map((status) => (
            <li key={status} className="flex justify-between border-b border-line py-2">
              <span>{status}</span>
              <span>
                {formatMoney(withdrawalMap[status]?.sum ?? 0)} ({withdrawalMap[status]?.count ?? 0})
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel mt-8 flex flex-wrap gap-3">
        <form
          action={async () => {
            "use server";
            await walletBackfillAction();
          }}
        >
          <button className="btn btn-primary" type="submit">
            Run wallet backfill
          </button>
        </form>
        <form
          action={async () => {
            "use server";
            await ensureSellerWalletsAction();
          }}
        >
          <button className="btn btn-secondary" type="submit">
            Ensure seller wallets
          </button>
        </form>
      </section>
    </div>
  );
}
