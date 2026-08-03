import Link from "next/link";
import { notFound } from "next/navigation";
import { FundEscrowForm } from "@/components/escrow/fund-form";
import { MilestonePlanner } from "@/components/escrow/milestone-planner";
import {
  approveMilestoneAction,
  markMilestoneDeliveredAction,
} from "@/lib/actions/commerce";
import { approveWorkAction } from "@/lib/actions/projects";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireSession } from "@/lib/utils";
import { getOrCreateWallet } from "@/lib/wallet";

export default async function EscrowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const escrow = await prisma.escrow.findUnique({
    where: { id },
    include: {
      project: true,
      buyer: { select: { name: true, email: true } },
      seller: { select: { name: true, email: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 5 },
      dispute: true,
      milestones: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!escrow) notFound();

  const isParty =
    escrow.buyerId === session.user.id ||
    escrow.sellerId === session.user.id ||
    session.user.role === "ADMIN";

  if (!isParty) notFound();

  const isBuyer = escrow.buyerId === session.user.id;
  const isSeller = escrow.sellerId === session.user.id;
  const wallet =
    isBuyer && escrow.status === "PENDING"
      ? await getOrCreateWallet(session.user.id)
      : null;
  const canPlanMilestones =
    isBuyer &&
    (escrow.status === "PENDING" || escrow.status === "FUNDED") &&
    !escrow.milestones.some((m) => m.status === "RELEASED");
  const deliveredMilestone = escrow.milestones.find((m) => m.status === "DELIVERED");
  const nextForSeller = escrow.milestones.find(
    (m) => m.status === "FUNDED" || m.status === "PENDING",
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/projects/${escrow.projectId}`} className="text-sm text-ink-soft">
        ← Back to project
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="badge">{escrow.status}</p>
          <h1 className="mt-3 font-display text-4xl">Escrow</h1>
          <p className="mt-2 text-ink-soft">{escrow.project.title}</p>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Amount</div>
          <div className="font-display text-3xl">{formatMoney(Number(escrow.amount))}</div>
          {Number(escrow.releasedAmount) > 0 ? (
            <p className="mt-1 text-xs text-ink-soft">
              Released {formatMoney(escrow.releasedAmount)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <Link href={`/dashboard/messages/${escrow.projectId}`} className="btn btn-secondary">
          Project messages
        </Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Buyer</div>
          <div className="mt-1 font-semibold">{escrow.buyer.name}</div>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Seller</div>
          <div className="mt-1 font-semibold">{escrow.seller.name}</div>
        </div>
      </section>

      {escrow.status === "PENDING" && isBuyer ? (
        <section className="panel mt-8">
          <h2 className="font-display text-2xl">Fund escrow</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Use prepaid wallet balance or pay directly with Paynow (web / Ecocash / OneMoney).
          </p>
          <div className="mt-4">
            <FundEscrowForm
              escrowId={escrow.id}
              amount={Number(escrow.amount)}
              walletBalance={Number(wallet?.balance ?? 0)}
            />
          </div>
        </section>
      ) : null}

      {canPlanMilestones ? (
        <MilestonePlanner escrowId={escrow.id} totalAmount={Number(escrow.amount)} />
      ) : null}

      <section className="mt-8">
        <h2 className="font-display text-2xl">Milestones</h2>
        <div className="mt-4 space-y-3">
          {escrow.milestones.length === 0 ? (
            <div className="panel text-ink-soft">Single full-delivery release (default).</div>
          ) : (
            escrow.milestones.map((m) => (
              <div key={m.id} className="panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="badge">{m.status}</p>
                    <h3 className="mt-2 font-semibold">
                      {m.orderIndex + 1}. {m.title}
                    </h3>
                    {m.description ? (
                      <p className="mt-1 text-sm text-ink-soft">{m.description}</p>
                    ) : null}
                    <p className="mt-2 text-sm">{formatMoney(m.amount)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {isSeller &&
                    escrow.status === "FUNDED" &&
                    nextForSeller?.id === m.id &&
                    (m.status === "FUNDED" || m.status === "PENDING") ? (
                      <form
                        action={async () => {
                          "use server";
                          await markMilestoneDeliveredAction(m.id);
                        }}
                      >
                        <button className="btn btn-primary" type="submit">
                          Mark delivered
                        </button>
                      </form>
                    ) : null}
                    {isBuyer && m.status === "DELIVERED" ? (
                      <form
                        action={async () => {
                          "use server";
                          await approveMilestoneAction(m.id);
                        }}
                      >
                        <button className="btn btn-primary" type="submit">
                          Approve & release
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {escrow.status === "FUNDED" &&
      isBuyer &&
      escrow.project.status === "DELIVERED" &&
      !deliveredMilestone ? (
        <form
          action={async () => {
            "use server";
            await approveWorkAction(escrow.id);
          }}
          className="panel mt-8"
        >
          <h2 className="font-display text-2xl">Approve delivery</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Approving releases funds to the seller wallet.
          </p>
          <button className="btn btn-primary mt-4" type="submit">
            Approve & release
          </button>
        </form>
      ) : null}

      {(escrow.status === "FUNDED" || escrow.status === "RELEASE_REQUESTED") && !escrow.dispute ? (
        <div className="mt-6">
          <Link
            href={`/dashboard/disputes/new?escrowId=${escrow.id}`}
            className="btn btn-secondary"
          >
            Open a dispute
          </Link>
        </div>
      ) : null}

      {escrow.dispute ? (
        <div className="mt-6">
          <Link href={`/dashboard/disputes/${escrow.dispute.id}`} className="text-forest">
            View dispute ({escrow.dispute.status}) →
          </Link>
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-2xl">Payment attempts</h2>
        <div className="table-wrap mt-4 panel">
          <table className="data">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Channel</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {escrow.payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-ink-soft">
                    No payment attempts yet.
                  </td>
                </tr>
              ) : (
                escrow.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-mono text-xs">{payment.merchantReference}</td>
                    <td>{payment.channel}</td>
                    <td>{payment.status}</td>
                    <td>{formatDate(payment.createdAt)}</td>
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
