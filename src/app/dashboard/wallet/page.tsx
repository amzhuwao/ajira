import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { WalletTopUpForm } from "@/components/wallet/top-up-form";
import { requestWithdrawalAction } from "@/lib/actions/payments";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";
import { getOrCreateWallet } from "@/lib/wallet";

export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  const session = await requireRole("BUYER", "SELLER", "ADMIN");
  const wallet = await getOrCreateWallet(session.user.id);
  const isBuyer = session.user.role === "BUYER" || session.user.role === "ADMIN";
  const isSeller = session.user.role === "SELLER" || session.user.role === "ADMIN";

  const [transactions, withdrawals, topUps, spendAgg] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        escrow: { include: { project: { select: { id: true, title: true } } } },
      },
    }),
    isSeller
      ? prisma.withdrawalRequest.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    isBuyer
      ? prisma.walletTopUp.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: 15,
        })
      : Promise.resolve([]),
    isBuyer
      ? prisma.walletTransaction.aggregate({
          where: { userId: session.user.id, type: "DEBIT" },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
  ]);

  const totalSpent = Number(spendAgg._sum.amount ?? 0);
  const totalToppedUp = transactions
    .filter((t) => t.type === "TOP_UP")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-4xl">Wallet</h1>
      <p className="mt-2 text-ink-soft">
        {session.user.role === "BUYER"
          ? "Preload funds with Paynow, then fund escrows from your balance. Review top-ups and spending below."
          : session.user.role === "SELLER"
            ? "Earnings land here after escrow release. Withdrawals are paid manually via Ecocash, OneMoney, or bank transfer."
            : "Platform wallets for prepaid buyer balances and seller earnings."}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Available</div>
          <div className="font-display text-4xl">{formatMoney(Number(wallet.balance))}</div>
        </div>
        {isBuyer ? (
          <>
            <div className="panel">
              <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Total spent</div>
              <div className="font-display text-3xl">{formatMoney(totalSpent)}</div>
              <p className="mt-1 text-xs text-ink-soft">Escrow funding from wallet</p>
            </div>
            <div className="panel">
              <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Recent top-ups</div>
              <div className="font-display text-3xl">{formatMoney(totalToppedUp)}</div>
              <p className="mt-1 text-xs text-ink-soft">From last 40 transactions</p>
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {isBuyer ? (
          <section className="panel">
            <h2 className="font-display text-2xl">Add funds</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Top up via Paynow web or Ecocash / OneMoney. Balance is ready to fund escrows.
            </p>
            <div className="mt-4">
              <WalletTopUpForm />
            </div>
          </section>
        ) : null}

        {isSeller && session.user.role !== "BUYER" ? (
          <section className="panel">
            <h2 className="font-display text-2xl">Request withdrawal</h2>
            <ActionForm action={requestWithdrawalAction} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="label" htmlFor="amount">
                  Amount (USD)
                </label>
                <input className="input" id="amount" name="amount" type="number" step="0.01" required />
              </div>
              <div>
                <label className="label" htmlFor="method">
                  Method
                </label>
                <select className="select" id="method" name="method" defaultValue="ECOCASH">
                  <option value="ECOCASH">Ecocash</option>
                  <option value="ONEMONEY">OneMoney</option>
                  <option value="BANK">Bank transfer</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="destination">
                  Destination (phone or account)
                </label>
                <input className="input" id="destination" name="destination" required />
              </div>
              <button className="btn btn-primary self-start" type="submit">
                Submit request
              </button>
            </ActionForm>
          </section>
        ) : null}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">
          {session.user.role === "BUYER" ? "Spending & activity" : "Transactions"}
        </h2>
        <div className="table-wrap mt-4 panel">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Balance</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-ink-soft">
                    No activity yet.
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td>{formatDate(txn.createdAt)}</td>
                    <td>
                      <span className="badge">{txn.type}</span>
                    </td>
                    <td>{formatMoney(Number(txn.amount))}</td>
                    <td>{formatMoney(Number(txn.balanceAfter))}</td>
                    <td>
                      {txn.description}
                      {txn.escrow?.project ? (
                        <>
                          {" · "}
                          <Link
                            href={`/dashboard/escrow/${txn.escrowId}`}
                            className="text-forest"
                          >
                            {txn.escrow.project.title}
                          </Link>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isBuyer && topUps.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl">Top-up attempts</h2>
          <div className="table-wrap mt-4 panel">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Amount</th>
                  <th>Channel</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {topUps.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.createdAt)}</td>
                    <td>{formatMoney(Number(t.amount))}</td>
                    <td>{t.channel}</td>
                    <td>
                      <span className="badge">{t.status}</span>
                      {t.creditedAt ? " · credited" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {isSeller && withdrawals.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl">Withdrawals</h2>
          <div className="table-wrap mt-4 panel">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Destination</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td>{formatDate(w.createdAt)}</td>
                    <td>{formatMoney(Number(w.amount))}</td>
                    <td>{w.method}</td>
                    <td>{w.destination}</td>
                    <td>
                      <span className="badge">{w.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
