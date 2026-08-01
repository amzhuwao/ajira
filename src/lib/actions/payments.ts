"use server";

import { PaymentChannel, PaymentStatus, EscrowStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/utils";
import {
  initiateMobilePayment,
  initiateWebPayment,
  isPaynowConfigured,
  pollPayment,
} from "@/lib/paynow";
import { fundEscrowSchema, withdrawalSchema } from "@/lib/validations";
import { debitForWithdrawal, getOrCreateWallet } from "@/lib/wallet";
import { transitionEscrow } from "@/lib/escrow";
import type { ActionState } from "./auth";

function moneyNumber(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value.toString());
}

export async function fundEscrowAction(
  _prev: ActionState & { instructions?: string; paymentId?: string },
  formData: FormData,
): Promise<ActionState & { instructions?: string; paymentId?: string }> {
  const session = await requireRole("BUYER", "ADMIN");

  if (!isPaynowConfigured()) {
    return {
      error:
        "Paynow is not configured. Set PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY.",
    };
  }

  const parsed = fundEscrowSchema.safeParse({
    escrowId: formData.get("escrowId"),
    channel: formData.get("channel"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid funding request" };
  }

  const escrow = await prisma.escrow.findUnique({
    where: { id: parsed.data.escrowId },
    include: { project: true, buyer: true },
  });

  if (!escrow || escrow.buyerId !== session.user.id) {
    return { error: "Escrow not found." };
  }

  if (escrow.status !== EscrowStatus.PENDING) {
    return { error: "Escrow is not awaiting payment." };
  }

  const reference = `AJIRA-${escrow.id.slice(-8)}-${Date.now()}`;
  const amount = moneyNumber(escrow.amount);
  const description = `Escrow: ${escrow.project.title}`;
  const returnUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/dashboard/escrow/return?escrowId=${escrow.id}`;

  if (parsed.data.channel === "WEB") {
    const result = await initiateWebPayment({
      reference,
      email: escrow.buyer.email,
      description,
      amount,
      returnUrl,
    });

    if (!result.success || !result.redirectUrl) {
      return { error: result.error ?? "Failed to initiate Paynow payment." };
    }

    await prisma.escrowPayment.create({
      data: {
        escrowId: escrow.id,
        merchantReference: reference,
        pollUrl: result.pollUrl,
        redirectUrl: result.redirectUrl,
        channel: PaymentChannel.WEB,
        amount: escrow.amount,
        status: PaymentStatus.SENT,
      },
    });

    redirect(result.redirectUrl);
  }

  const phone = parsed.data.phone!;
  const method = parsed.data.channel === "ECOCASH" ? "ecocash" : "onemoney";
  const result = await initiateMobilePayment({
    reference,
    email: escrow.buyer.email,
    description,
    amount,
    phone,
    method,
  });

  if (!result.success) {
    return { error: result.error ?? "Failed to initiate mobile payment." };
  }

  const payment = await prisma.escrowPayment.create({
    data: {
      escrowId: escrow.id,
      merchantReference: reference,
      pollUrl: result.pollUrl,
      channel:
        parsed.data.channel === "ECOCASH"
          ? PaymentChannel.ECOCASH
          : PaymentChannel.ONEMONEY,
      phone,
      amount: escrow.amount,
      status: PaymentStatus.SENT,
      instructions: result.instructions,
    },
  });

  revalidatePath(`/dashboard/escrow/${escrow.id}`);
  return {
    success: "Mobile payment initiated. Complete the prompt on your phone.",
    instructions: result.instructions,
    paymentId: payment.id,
  };
}

export async function pollEscrowPaymentAction(paymentId: string): Promise<ActionState> {
  await requireSession();

  const payment = await prisma.escrowPayment.findUnique({
    where: { id: paymentId },
    include: { escrow: true },
  });

  if (!payment?.pollUrl) {
    return { error: "Payment not found." };
  }

  if (payment.escrow.status === EscrowStatus.FUNDED) {
    return { success: "Already funded." };
  }

  const status = await pollPayment(payment.pollUrl);

  await prisma.escrowPayment.update({
    where: { id: payment.id },
    data: {
      rawStatus: status.status,
      paynowReference: status.paynowReference
        ? String(status.paynowReference)
        : payment.paynowReference,
      status: status.paid ? PaymentStatus.PAID : payment.status,
    },
  });

  if (status.paid && payment.escrow.status === EscrowStatus.PENDING) {
    await transitionEscrow(payment.escrowId, EscrowStatus.FUNDED, {
      triggeredBy: "paynow_poll",
      reason: "Payment confirmed via poll",
      metadata: { paymentId: payment.id, status: status.status },
    });
    revalidatePath(`/dashboard/escrow/${payment.escrowId}`);
    return { success: "Payment confirmed. Escrow funded." };
  }

  return { error: `Payment status: ${status.status || "pending"}` };
}

export async function requestWithdrawalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("SELLER");

  const parsed = withdrawalSchema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method"),
    destination: formData.get("destination"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid withdrawal" };
  }

  const wallet = await getOrCreateWallet(session.user.id);
  if (Number(wallet.balance) < parsed.data.amount) {
    return { error: "Insufficient balance." };
  }

  await prisma.$transaction(async (tx) => {
    await debitForWithdrawal({
      userId: session.user.id,
      amount: parsed.data.amount,
      description: "Withdrawal request",
      tx,
    });

    await tx.withdrawalRequest.create({
      data: {
        userId: session.user.id,
        amount: parsed.data.amount,
        method: parsed.data.method,
        destination: parsed.data.destination,
        status: "PENDING",
      },
    });
  });

  revalidatePath("/dashboard/wallet");
  return { success: "Withdrawal requested. An admin will process the payout." };
}

export async function processWithdrawalAction(
  withdrawalId: string,
  decision: "APPROVED" | "COMPLETED" | "REJECTED",
  adminNote?: string,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const withdrawal = await prisma.withdrawalRequest.findUnique({
    where: { id: withdrawalId },
  });

  if (!withdrawal) return { error: "Not found." };

  if (decision === "REJECTED" && withdrawal.status === "PENDING") {
    await prisma.$transaction(async (tx) => {
      await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: "REJECTED",
          adminNote: adminNote ?? "Rejected",
          processedAt: new Date(),
        },
      });

      await getOrCreateWallet(withdrawal.userId, tx);
      const updated = await tx.sellerWallet.update({
        where: { userId: withdrawal.userId },
        data: { balance: { increment: withdrawal.amount } },
      });

      await tx.walletTransaction.create({
        data: {
          userId: withdrawal.userId,
          type: "CREDIT",
          amount: withdrawal.amount,
          balanceAfter: updated.balance,
          description: "Withdrawal rejected — balance restored",
          status: "COMPLETED",
        },
      });
    });
  } else {
    await prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: decision,
        adminNote: adminNote ?? null,
        processedAt: decision === "COMPLETED" ? new Date() : withdrawal.processedAt,
      },
    });
  }

  // silence unused
  void session;

  revalidatePath("/dashboard/admin");
  return { success: `Withdrawal marked ${decision}.` };
}
