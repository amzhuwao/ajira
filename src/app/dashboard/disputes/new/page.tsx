import { ActionForm } from "@/components/ui/action-form";
import { openDisputeAction } from "@/lib/actions/disputes";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/utils";
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
        For {escrow.project.title}. An admin will review evidence and decide release
        or refund.
      </p>
      <ActionForm action={openDisputeAction} className="panel mt-8 flex flex-col gap-4">
        <input type="hidden" name="escrowId" value={escrow.id} />
        <div>
          <label className="label" htmlFor="reason">
            What went wrong?
          </label>
          <textarea className="textarea" id="reason" name="reason" required minLength={20} />
        </div>
        <button className="btn btn-primary self-start" type="submit">
          Submit dispute
        </button>
      </ActionForm>
    </div>
  );
}
