import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import {
  addDisputeMessageAction,
  resolveDisputeAction,
  uploadEvidenceAction,
} from "@/lib/actions/disputes";
import { prisma } from "@/lib/prisma";
import { formatDate, requireSession } from "@/lib/utils";

export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      escrow: { include: { project: true } },
      openedBy: { select: { name: true } },
      messages: {
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      evidence: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!dispute) notFound();

  const isParty =
    dispute.escrow.buyerId === session.user.id ||
    dispute.escrow.sellerId === session.user.id ||
    session.user.role === "ADMIN";
  if (!isParty) notFound();

  const isAdmin = session.user.role === "ADMIN";
  const open = ["OPEN", "UNDER_REVIEW"].includes(dispute.status);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/escrow/${dispute.escrowId}`} className="text-sm text-ink-soft">
        ← Escrow
      </Link>
      <p className="badge mt-4">{dispute.status}</p>
      <h1 className="mt-3 font-display text-4xl">Dispute</h1>
      <p className="mt-2 text-ink-soft">
        {dispute.escrow.project.title} · opened by {dispute.openedBy.name} on{" "}
        {formatDate(dispute.createdAt)}
      </p>

      <section className="panel mt-8">
        <h2 className="font-display text-2xl">Reason</h2>
        <p className="mt-3 whitespace-pre-wrap text-ink-soft">{dispute.reason}</p>
        {dispute.resolution ? (
          <p className="mt-4 rounded-xl bg-sand/50 p-3 text-sm whitespace-pre-wrap">
            {dispute.resolution}
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Thread</h2>
        <div className="mt-4 space-y-3">
          {dispute.messages.map((message) => (
            <div key={message.id} className="panel">
              <div className="text-sm font-semibold">
                {message.author.name}{" "}
                <span className="text-xs font-normal text-ink-soft">
                  · {message.author.role} · {formatDate(message.createdAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{message.body}</p>
            </div>
          ))}
        </div>
        {open ? (
          <ActionForm action={addDisputeMessageAction} className="panel mt-4 flex flex-col gap-3">
            <input type="hidden" name="disputeId" value={dispute.id} />
            <textarea className="textarea" name="body" required placeholder="Add a message…" />
            <button className="btn btn-secondary self-start" type="submit">
              Send message
            </button>
          </ActionForm>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Evidence</h2>
        <ul className="mt-4 space-y-2">
          {dispute.evidence.map((item) => (
            <li key={item.id}>
              <a href={item.filePath} className="text-forest" target="_blank" rel="noreferrer">
                {item.fileName}
              </a>
            </li>
          ))}
        </ul>
        {open ? (
          <ActionForm action={uploadEvidenceAction} className="panel mt-4 flex flex-col gap-3">
            <input type="hidden" name="disputeId" value={dispute.id} />
            <input className="input" type="file" name="file" accept=".png,.jpg,.jpeg,.webp,.pdf" required />
            <button className="btn btn-secondary self-start" type="submit">
              Upload evidence
            </button>
          </ActionForm>
        ) : null}
      </section>

      {isAdmin && open ? (
        <section className="panel mt-8">
          <h2 className="font-display text-2xl">Admin resolution</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Refunds must also be processed manually in the Paynow merchant dashboard.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <form
              action={async () => {
                "use server";
                await resolveDisputeAction(
                  dispute.id,
                  "RELEASE",
                  "Admin released funds to seller after review.",
                );
              }}
            >
              <button className="btn btn-primary" type="submit">
                Resolve: release to seller
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await resolveDisputeAction(
                  dispute.id,
                  "REFUND",
                  "Admin marked refunded. Complete reversal in Paynow merchant tools.",
                );
              }}
            >
              <button className="btn btn-secondary" type="submit">
                Resolve: refund buyer
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}
