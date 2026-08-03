import Link from "next/link";
import { pollWalletTopUpAction } from "@/lib/actions/payments";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/utils";

export const metadata = { title: "Wallet return" };

export default async function WalletReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole("BUYER", "ADMIN");
  await searchParams;

  const pending = await prisma.walletTopUp.findFirst({
    where: {
      userId: session.user.id,
      creditedAt: null,
      status: { in: ["SENT", "CREATED", "PAID"] },
    },
    orderBy: { createdAt: "desc" },
  });

  let message = "Checking your top-up…";
  if (pending) {
    const result = await pollWalletTopUpAction(pending.id);
    message = result.success ?? result.error ?? message;
  } else {
    message = "No pending top-up found. If you just paid, wait a moment and refresh.";
  }

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="font-display text-3xl">Wallet top-up</h1>
      <p className="mt-4 text-ink-soft">{message}</p>
      <Link href="/dashboard/wallet" className="btn btn-primary mt-8 inline-flex">
        Back to wallet
      </Link>
    </div>
  );
}
