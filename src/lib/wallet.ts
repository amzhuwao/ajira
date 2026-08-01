import { Prisma, WalletTxnType } from "@prisma/client";
import { prisma } from "./prisma";

export async function getOrCreateWallet(userId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  const existing = await client.sellerWallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return client.sellerWallet.create({
    data: { userId, balance: 0, pendingBalance: 0 },
  });
}

export const ensureWallet = getOrCreateWallet;

export async function creditEarnings(params: {
  userId: string;
  amount: Prisma.Decimal | number | string;
  escrowId: string;
  description?: string;
  tx?: Prisma.TransactionClient;
}) {
  const amount = new Prisma.Decimal(params.amount);
  if (amount.lte(0)) {
    throw new Error("Amount must be positive");
  }

  const run = async (client: Prisma.TransactionClient) => {
    await getOrCreateWallet(params.userId, client);

    const wallet = await client.sellerWallet.update({
      where: { userId: params.userId },
      data: { balance: { increment: amount } },
    });

    await client.walletTransaction.create({
      data: {
        userId: params.userId,
        escrowId: params.escrowId,
        type: WalletTxnType.CREDIT,
        amount,
        balanceAfter: wallet.balance,
        description: params.description ?? "Project earnings",
        status: "COMPLETED",
      },
    });

    return wallet;
  };

  if (params.tx) return run(params.tx);
  return prisma.$transaction(async (client) => run(client));
}

export async function debitForWithdrawal(params: {
  userId: string;
  amount: Prisma.Decimal | number | string;
  description?: string;
  tx?: Prisma.TransactionClient;
}) {
  const amount = new Prisma.Decimal(params.amount);
  if (amount.lte(0)) {
    throw new Error("Amount must be positive");
  }

  const run = async (client: Prisma.TransactionClient) => {
    const wallet = await getOrCreateWallet(params.userId, client);
    if (new Prisma.Decimal(wallet.balance).lt(amount)) {
      throw new Error("Insufficient wallet balance");
    }

    const updated = await client.sellerWallet.update({
      where: { userId: params.userId },
      data: { balance: { decrement: amount } },
    });

    await client.walletTransaction.create({
      data: {
        userId: params.userId,
        type: WalletTxnType.WITHDRAWAL,
        amount,
        balanceAfter: updated.balance,
        description: params.description ?? "Withdrawal",
        status: "COMPLETED",
      },
    });

    return updated;
  };

  if (params.tx) return run(params.tx);
  return prisma.$transaction(async (client) => run(client));
}
