import { ActionForm } from "@/components/ui/action-form";
import { requestWithdrawalAction } from "@/lib/actions/payments";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";
import { getOrCreateWallet } from "@/lib/wallet";

export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  const session = await requireRole("SELLER", "ADMIN");
  const wallet = await getOrCreateWallet(session.user.id);

  const [transactions, withdrawals] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.withdrawalRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-4xl">Wallet</h1>
      <p className="mt-2 text-ink-soft">
        Earnings land here after escrow release. Withdrawals are paid manually via
        Ecocash, OneMoney, or bank transfer.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Available</div>
          <div className="font-display text-4xl">{formatMoney(Number(wallet.balance))}</div>
        </div>
        <div className="panel">
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
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Transactions</h2>
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
              {transactions.map((txn) => (
                <tr key={txn.id}>
                  <td>{formatDate(txn.createdAt)}</td>
                  <td>{txn.type}</td>
                  <td>{formatMoney(Number(txn.amount))}</td>
                  <td>{formatMoney(Number(txn.balanceAfter))}</td>
                  <td>{txn.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
    </div>
  );
}
