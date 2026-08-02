import Link from "next/link";
import { adminMarkEscrowDisputedAction } from "@/lib/actions/disputes";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";

export const metadata = { title: "Admin escrows" };

export default async function AdminEscrowsPage() {
  await requireRole("ADMIN");

  const escrows = await prisma.escrow.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      project: true,
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
      dispute: { select: { id: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-4xl">Escrows</h1>
      <div className="mt-8 space-y-3">
        {escrows.map((e) => (
          <div key={e.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/dashboard/escrow/${e.id}`} className="font-semibold text-forest">
                  {e.project.title}
                </Link>
                <div className="text-sm text-ink-soft">
                  {formatMoney(e.amount)}
                  {Number(e.feeAmount) > 0 ? ` · fee ${formatMoney(e.feeAmount)}` : ""}
                  {" · "}
                  {e.buyer.name} → {e.seller.name} · {formatDate(e.createdAt)}
                </div>
              </div>
              <span className="badge">{e.status}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/dashboard/escrow/${e.id}`} className="btn btn-ghost">
                Open
              </Link>
              {e.dispute ? (
                <Link href={`/dashboard/disputes/${e.dispute.id}`} className="btn btn-secondary">
                  View dispute
                </Link>
              ) : ["FUNDED", "RELEASE_REQUESTED", "REFUND_REQUESTED"].includes(e.status) ? (
                <form
                  action={async () => {
                    "use server";
                    await adminMarkEscrowDisputedAction(e.id);
                  }}
                >
                  <button className="btn btn-secondary" type="submit">
                    Mark disputed
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
