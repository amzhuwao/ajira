import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { GatewayTestPanel } from "@/components/admin/gateway-test-panel";
import { updatePaynowGatewayAction } from "@/lib/actions/admin";
import { getPaynowStatusSummary } from "@/lib/paynow";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";

export const metadata = { title: "Payment gateway" };

export default async function AdminGatewayPage() {
  await requireRole("ADMIN");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [status, paymentCounts, recentPayments, recentTopUps] = await Promise.all([
    getPaynowStatusSummary(),
    prisma.escrowPayment.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    prisma.escrowPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        escrow: { include: { project: { select: { title: true } } } },
      },
    }),
    prisma.walletTopUp.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const countMap = Object.fromEntries(
    paymentCounts.map((row) => [row.status, row._count]),
  ) as Record<string, number>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Payment gateway</h1>
          <p className="mt-2 text-ink-soft">
            View Paynow readiness, edit credentials, and run connection tests.
          </p>
        </div>
        <Link href="/dashboard/admin/payments" className="btn btn-ghost">
          Payment attempts →
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Status</div>
          <div className="mt-2 font-display text-2xl">
            {status.ready ? "Ready" : status.configured ? "Disabled" : "Not configured"}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {status.enabled ? "Enabled" : "Disabled"} · key{" "}
            {status.hasIntegrationKey ? "set" : "missing"}
          </p>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Paid (24h)</div>
          <div className="mt-2 font-display text-2xl">{countMap.PAID ?? 0}</div>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Sent (24h)</div>
          <div className="mt-2 font-display text-2xl">{countMap.SENT ?? 0}</div>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Failed (24h)</div>
          <div className="mt-2 font-display text-2xl">
            {(countMap.FAILED ?? 0) + (countMap.CANCELLED ?? 0)}
          </div>
        </div>
      </div>

      <section className="panel mt-8 space-y-3">
        <h2 className="font-display text-2xl">Current configuration</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-soft">Integration ID</dt>
            <dd className="font-mono">{status.integrationId || "—"}</dd>
            <dd className="text-xs text-ink-soft">Source: {status.sources.integrationId}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Integration key</dt>
            <dd className="font-mono">{status.integrationKeyMasked || "—"}</dd>
            <dd className="text-xs text-ink-soft">Source: {status.sources.integrationKey}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-ink-soft">Result URL (webhook)</dt>
            <dd className="break-all font-mono text-xs">{status.resultUrl}</dd>
            <dd className="text-xs text-ink-soft">Source: {status.sources.resultUrl}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-ink-soft">Return URL</dt>
            <dd className="break-all font-mono text-xs">{status.returnUrl}</dd>
            <dd className="text-xs text-ink-soft">Source: {status.sources.returnUrl}</dd>
          </div>
        </dl>
      </section>

      <ActionForm
        action={updatePaynowGatewayAction}
        className="panel mt-8 grid gap-4 sm:grid-cols-2"
      >
        <h2 className="font-display text-2xl sm:col-span-2">Edit credentials</h2>
        <p className="text-sm text-ink-soft sm:col-span-2">
          Values saved here override environment variables. Leave the key blank to keep the
          current secret.
        </p>
        <div>
          <label className="label" htmlFor="paynow_enabled">
            Gateway enabled
          </label>
          <select
            className="select"
            id="paynow_enabled"
            name="paynow_enabled"
            defaultValue={status.enabled ? "true" : "false"}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="paynow_integration_id">
            Integration ID
          </label>
          <input
            className="input font-mono"
            id="paynow_integration_id"
            name="paynow_integration_id"
            defaultValue={status.integrationId}
            autoComplete="off"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="paynow_integration_key">
            Integration key
          </label>
          <input
            className="input font-mono"
            id="paynow_integration_key"
            name="paynow_integration_key"
            type="password"
            placeholder={
              status.hasIntegrationKey
                ? `Leave blank to keep ${status.integrationKeyMasked}`
                : "Paste integration key"
            }
            autoComplete="new-password"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="paynow_result_url">
            Result URL
          </label>
          <input
            className="input font-mono text-sm"
            id="paynow_result_url"
            name="paynow_result_url"
            defaultValue={status.resultUrl}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="paynow_return_url">
            Default return URL
          </label>
          <input
            className="input font-mono text-sm"
            id="paynow_return_url"
            name="paynow_return_url"
            defaultValue={status.returnUrl}
          />
        </div>
        <div className="sm:col-span-2">
          <button className="btn btn-primary" type="submit">
            Save gateway settings
          </button>
        </div>
      </ActionForm>

      <div className="mt-8">
        <GatewayTestPanel />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Recent escrow payments</h2>
        <div className="table-wrap panel mt-4">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Project</th>
                <th>Amount</th>
                <th>Channel</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-ink-soft">
                    No payments yet.
                  </td>
                </tr>
              ) : (
                recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.createdAt)}</td>
                    <td>{p.escrow.project.title}</td>
                    <td>{formatMoney(Number(p.amount))}</td>
                    <td>{p.channel}</td>
                    <td>
                      <span className="badge">{p.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Recent wallet top-ups</h2>
        <div className="table-wrap panel mt-4">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Amount</th>
                <th>Channel</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTopUps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-ink-soft">
                    No top-ups yet.
                  </td>
                </tr>
              ) : (
                recentTopUps.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.createdAt)}</td>
                    <td>
                      {t.user.name}
                      <div className="text-xs text-ink-soft">{t.user.email}</div>
                    </td>
                    <td>{formatMoney(Number(t.amount))}</td>
                    <td>{t.channel}</td>
                    <td>
                      <span className="badge">{t.status}</span>
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
