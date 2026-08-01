import { Prisma, WalletTxnType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getOrCreateWallet(
  userId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  const existing = await client.sellerWallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return client.sellerWallet.create({
    data: { userId, balance: 0, pendingBalance: 0 },
  });
}

/** Alias used by some actions */
export const ensureWallet = getOrCreateWallet;

export async function creditEarnings(params: {
  userId: string;
  amount: number;
  escrowId: string;
  description?: string;
  tx?: Prisma.TransactionClient;
}) {
  const amount = Number(params.amount);
  if (!(amount > 0)) throw new Error("Amount must be positive");

  const run = async (client: Prisma.TransactionClient) => {
    const wallet = await getOrCreateWallet(params.userId, client);
    const balanceAfter = Number(wallet.balance) + amount;
    const updated = await client.sellerWallet.update({
      where: { id: wallet.id },
      data: { balance: balanceAfter },
    });
    await client.walletTransaction.create({
      data: {
        walletId: updated.id,
        userId: params.userId,
        escrowId: params.escrowId,
        type: WalletTxnType.CREDIT,
        amount,
        balanceAfter,
        description: params.description ?? "Project earnings",
        status: "COMPLETED",
      },
    });
    return updated;
  };

  if (params.tx) return run(params.tx);
  return prisma.$transaction(run);
}

export async function debitForWithdrawal(params: {
  userId: string;
  amount: number;
  description?: string;
  tx?: Prisma.TransactionClient;
}) {
  const amount = Number(params.amount);
  if (!(amount > 0)) throw new Error("Amount must be positive");

  const run = async (client: Prisma.TransactionClient) => {
    const wallet = await getOrCreateWallet(params.userId, client);
    if (Number(wallet.balance) < amount) {
      throw new Error("Insufficient wallet balance");
    }
    const balanceAfter = Number(wallet.balance) - amount;
    const updated = await client.sellerWallet.update({
      where: { id: wallet.id },
      data: { balance: balanceAfter },
    });
    await client.walletTransaction.create({
      data: {
        walletId: updated.id,
        userId: params.userId,
        type: WalletTxnType.WITHDRAWAL,
        amount,
        balanceAfter,
        description: params.description ?? "Withdrawal",
        status: "COMPLETED",
      },
    });
    return updated;
  };

  if (params.tx) return run(params.tx);
  return prisma.$transaction(run);
}
