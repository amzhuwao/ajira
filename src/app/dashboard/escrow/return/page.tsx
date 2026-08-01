import Link from "next/link";
import { EscrowStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pollPayment } from "@/lib/paynow";
import { transitionEscrow } from "@/lib/escrow";
import { requireSession } from "@/lib/utils";

export default async function EscrowReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ escrowId?: string }>;
}) {
  const session = await requireSession();
  const { escrowId } = await searchParams;

  let message = "Payment return received. Confirming with Paynow…";
  let funded = false;

  if (escrowId) {
    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: {
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (
      escrow &&
      (escrow.buyerId === session.user.id || session.user.role === "ADMIN")
    ) {
      if (escrow.status === EscrowStatus.FUNDED) {
        funded = true;
        message = "Escrow is funded.";
      } else {
        const latest = escrow.payments[0];
        if (latest?.pollUrl) {
          try {
            const status = await pollPayment(latest.pollUrl);
            await prisma.escrowPayment.update({
              where: { id: latest.id },
              data: {
                rawStatus: status.status,
                status: status.paid ? PaymentStatus.PAID : latest.status,
                paynowReference: status.paynowReference
                  ? String(status.paynowReference)
                  : latest.paynowReference,
              },
            });
            if (status.paid && escrow.status === EscrowStatus.PENDING) {
              await transitionEscrow(escrow.id, EscrowStatus.FUNDED, {
                triggeredBy: "paynow_return",
                userId: session.user.id,
                reason: "Confirmed on return page poll",
              });
              funded = true;
              message = "Payment confirmed. Escrow is now funded.";
            } else {
              message = `Paynow status: ${status.status || "pending"}. If you paid, wait a moment and refresh.`;
            }
          } catch {
            message =
              "Could not reach Paynow yet. Funding will update when the result webhook arrives.";
          }
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-lg panel mt-10">
      <h1 className="font-display text-3xl">
        {funded ? "Payment successful" : "Payment update"}
      </h1>
      <p className="mt-3 text-ink-soft">{message}</p>
      {escrowId ? (
        <Link href={`/dashboard/escrow/${escrowId}`} className="btn btn-primary mt-6 inline-flex">
          Back to escrow
        </Link>
      ) : (
        <Link href="/dashboard" className="btn btn-primary mt-6 inline-flex">
          Dashboard
        </Link>
      )}
    </div>
  );
}
