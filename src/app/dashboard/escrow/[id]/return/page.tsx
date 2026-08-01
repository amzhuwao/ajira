import Link from "next/link";
import { redirect } from "next/navigation";
import { EscrowStatus } from "@prisma/client";
import { pollEscrowPaymentAction } from "@/lib/actions/payments";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";

export default async function EscrowReturnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const escrow = await prisma.escrow.findUnique({
    where: { id },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      project: true,
    },
  });
  if (!escrow || escrow.buyerId !== session.user.id) {
    redirect("/dashboard");
  }

  const latest = escrow.payments[0];
  if (latest && escrow.status === EscrowStatus.PENDING) {
    await pollEscrowPaymentAction(latest.id);
  }

  const fresh = await prisma.escrow.findUnique({ where: { id } });

  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="card animate-fade-up text-center">
        <h1 className="font-display text-2xl">
          {fresh?.status === "FUNDED" ? "Payment received" : "Checking payment…"}
        </h1>
        <p className="mt-3 text-ink-soft">
          Escrow for {escrow.project.title} · {formatMoney(escrow.amount)}
        </p>
        <p className="mt-2 text-sm uppercase tracking-wide text-forest">
          {fresh?.status}
        </p>
        <p className="mt-4 text-sm text-ink-soft">
          Funding is confirmed by Paynow&apos;s result webhook and poll. This page
          is only your return URL.
        </p>
        <Link href={`/dashboard/escrow/${id}`} className="btn btn-primary mt-6 inline-flex">
          Back to escrow
        </Link>
      </div>
    </div>
  );
}
