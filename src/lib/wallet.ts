import { Prisma, WalletTxnType } from "@prisma/client";
import { prisma } from "./prisma";
import { computeCommission, getSettingNumber } from "./settings";

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
  applyCommission?: boolean;
  tx?: Prisma.TransactionClient;
}) {
  const gross = new Prisma.Decimal(params.amount);
  if (gross.lte(0)) {
    throw new Error("Amount must be positive");
  }

  const run = async (client: Prisma.TransactionClient) => {
    let creditAmount = gross;
    let fee = new Prisma.Decimal(0);

    let commissionPercent = 0;
    if (params.applyCommission !== false) {
      commissionPercent = await getSettingNumber("commission_percentage", 10);
      const computed = computeCommission(Number(gross), commissionPercent);
      fee = new Prisma.Decimal(computed.fee);
      creditAmount = new Prisma.Decimal(computed.net);

      await client.escrow.update({
        where: { id: params.escrowId },
        data: { feeAmount: { increment: fee } },
      });
    }

    await getOrCreateWallet(params.userId, client);

    if (creditAmount.gt(0)) {
      const wallet = await client.sellerWallet.update({
        where: { userId: params.userId },
        data: { balance: { increment: creditAmount } },
      });

      await client.walletTransaction.create({
        data: {
          userId: params.userId,
          escrowId: params.escrowId,
          type: WalletTxnType.CREDIT,
          amount: creditAmount,
          balanceAfter: wallet.balance,
          description: params.description ?? "Project earnings",
          status: "COMPLETED",
        },
      });

      if (fee.gt(0)) {
        await client.walletTransaction.create({
          data: {
            userId: params.userId,
            escrowId: params.escrowId,
            type: WalletTxnType.PLATFORM_FEE,
            amount: fee,
            balanceAfter: wallet.balance,
            description: `Platform commission (${commissionPercent}%)`,
            status: "COMPLETED",
          },
        });
      }

      return wallet;
    }

    return getOrCreateWallet(params.userId, client);
  };

  if (params.tx) return run(params.tx);
  return prisma.$transaction(async (client) => run(client));
}

/** Credit prepaid balance after a successful Paynow top-up (idempotent via creditedAt). */
export async function creditTopUp(params: {
  userId: string;
  amount: Prisma.Decimal | number | string;
  topUpId: string;
  description?: string;
  tx?: Prisma.TransactionClient;
}) {
  const amount = new Prisma.Decimal(params.amount);
  if (amount.lte(0)) {
    throw new Error("Amount must be positive");
  }

  const run = async (client: Prisma.TransactionClient) => {
    const topUp = await client.walletTopUp.findUnique({ where: { id: params.topUpId } });
    if (!topUp) throw new Error("Top-up not found");
    if (topUp.creditedAt) {
      return getOrCreateWallet(params.userId, client);
    }

    await getOrCreateWallet(params.userId, client);
    const wallet = await client.sellerWallet.update({
      where: { userId: params.userId },
      data: { balance: { increment: amount } },
    });

    await client.walletTransaction.create({
      data: {
        userId: params.userId,
        type: WalletTxnType.TOP_UP,
        amount,
        balanceAfter: wallet.balance,
        description: params.description ?? "Wallet top-up",
        status: "COMPLETED",
      },
    });

    await client.walletTopUp.update({
      where: { id: params.topUpId },
      data: {
        status: "PAID",
        creditedAt: new Date(),
      },
    });

    return wallet;
  };

  if (params.tx) return run(params.tx);
  return prisma.$transaction(async (client) => run(client));
}

/** Debit buyer prepaid balance to fund an escrow. */
export async function debitForEscrow(params: {
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
        escrowId: params.escrowId,
        type: WalletTxnType.DEBIT,
        amount,
        balanceAfter: updated.balance,
        description: params.description ?? "Escrow funding",
        status: "COMPLETED",
      },
    });

    return updated;
  };

  if (params.tx) return run(params.tx);
  return prisma.$transaction(async (client) => run(client));
}

/** Restore buyer balance when a wallet-funded escrow is refunded. */
export async function creditEscrowRefund(params: {
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
        description: params.description ?? "Escrow refund to wallet",
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
