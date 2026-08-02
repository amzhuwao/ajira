import { OpenDisputeForm } from "@/components/disputes/open-dispute-form";
import { prisma } from "@/lib/prisma";
import { formatMoney, requireSession } from "@/lib/utils";
import { notFound } from "next/navigation";

export const metadata = { title: "Open dispute" };

export default async function NewDisputePage({
  searchParams,
}: {
  searchParams: Promise<{ escrowId?: string }>;
}) {
  const session = await requireSession();
  const { escrowId } = await searchParams;
  if (!escrowId) notFound();

  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: { project: true },
  });

  if (!escrow) notFound();
  const isParty =
    escrow.buyerId === session.user.id ||
    escrow.sellerId === session.user.id ||
    session.user.role === "ADMIN";
  if (!isParty) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl">Open a dispute</h1>
      <p className="mt-2 text-ink-soft">
        For {escrow.project.title} ({formatMoney(escrow.amount)}). An admin will review
        evidence and can release, refund, or split funds.
      </p>
      <OpenDisputeForm escrowId={escrow.id} />
    </div>
  );
}
