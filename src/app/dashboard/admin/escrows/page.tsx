import Link from "next/link";
import {
  adminMarkEscrowDisputedAction,
} from "@/lib/actions/disputes";
import {
  adminRefundEscrowAction,
  adminReleaseEscrowAction,
} from "@/lib/actions/admin";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";
import type { EscrowStatus } from "@prisma/client";

export const metadata = { title: "Admin escrows" };

const STATUSES: Array<EscrowStatus | "ALL"> = [
  "ALL",
  "PENDING",
  "FUNDED",
  "RELEASE_REQUESTED",
  "REFUND_REQUESTED",
  "DISPUTED",
  "RELEASED",
  "REFUNDED",
  "CANCELED",
];

export default async function AdminEscrowsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const status = (params.status?.toUpperCase() || "ALL") as EscrowStatus | "ALL";
  const q = params.q?.trim() ?? "";

  const escrows = await prisma.escrow.findMany({
    where: {
      ...(status !== "ALL" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { project: { title: { contains: q, mode: "insensitive" } } },
              { buyer: { name: { contains: q, mode: "insensitive" } } },
              { seller: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      project: true,
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
      dispute: { select: { id: true } },
    },
  });

  const actionable = ["FUNDED", "RELEASE_REQUESTED", "REFUND_REQUESTED"] as const;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-4xl">Escrows</h1>
      <p className="mt-2 text-ink-soft">
        Monitor funding, force release or refund, or escalate to a dispute.
      </p>

      <form className="mt-6 flex flex-wrap gap-2" method="get">
        <input
          className="input min-w-[200px] flex-1"
          name="q"
          defaultValue={q}
          placeholder="Search project or party"
        />
        <select className="input" name="status" defaultValue={status}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>

      <div className="mt-8 space-y-3">
        {escrows.length === 0 ? (
          <div className="panel text-ink-soft">No escrows match.</div>
        ) : null}
        {escrows.map((e) => {
          const canForce = (actionable as readonly string[]).includes(e.status);
          return (
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
                ) : null}
                {canForce ? (
                  <>
                    <form
                      action={async () => {
                        "use server";
                        await adminReleaseEscrowAction(e.id);
                      }}
                    >
                      <button className="btn btn-primary" type="submit">
                        Release
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await adminRefundEscrowAction(e.id);
                      }}
                    >
                      <button className="btn btn-secondary" type="submit">
                        Refund
                      </button>
                    </form>
                    {!e.dispute ? (
                      <form
                        action={async () => {
                          "use server";
                          await adminMarkEscrowDisputedAction(e.id);
                        }}
                      >
                        <button className="btn btn-ghost" type="submit">
                          Hold / dispute
                        </button>
                      </form>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
