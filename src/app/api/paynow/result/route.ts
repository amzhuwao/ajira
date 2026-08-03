import { NextRequest, NextResponse } from "next/server";
import { EscrowStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pollPayment, verifyPaynowHash } from "@/lib/paynow";
import { transitionEscrow } from "@/lib/escrow";
import { creditTopUp } from "@/lib/wallet";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let payload: Record<string, string> = {};

  if (contentType.includes("application/json")) {
    payload = (await request.json()) as Record<string, string>;
  } else {
    const form = await request.formData();
    form.forEach((value, key) => {
      payload[key] = String(value);
    });
  }

  const hash = payload.hash ?? payload.Hash ?? "";
  if (hash) {
    const valid = await verifyPaynowHash(payload, hash);
    if (!valid) {
      console.warn("Paynow result hash mismatch", payload.reference);
    }
  }

  const reference = payload.reference ?? payload.Reference;
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  // Wallet top-up
  const topUp = await prisma.walletTopUp.findUnique({
    where: { merchantReference: reference },
  });
  if (topUp) {
    if (topUp.creditedAt) {
      return NextResponse.json({ ok: true, status: "already_credited" });
    }

    let paid = ["Paid", "Awaiting Delivery", "Delivered"].includes(
      payload.status ?? payload.Status ?? "",
    );

    if (topUp.pollUrl) {
      try {
        const polled = await pollPayment(topUp.pollUrl);
        paid = polled.paid || paid;
        await prisma.walletTopUp.update({
          where: { id: topUp.id },
          data: {
            rawStatus: polled.status || payload.status,
            paynowReference: polled.paynowReference
              ? String(polled.paynowReference)
              : payload.paynowreference ?? topUp.paynowReference,
            status: paid ? PaymentStatus.PAID : topUp.status,
          },
        });
      } catch (error) {
        console.error("Paynow top-up poll failed", error);
      }
    }

    if (paid) {
      await creditTopUp({
        userId: topUp.userId,
        amount: topUp.amount,
        topUpId: topUp.id,
        description: "Wallet top-up via Paynow",
      });
    }

    return NextResponse.json({ ok: true });
  }

  const payment = await prisma.escrowPayment.findUnique({
    where: { merchantReference: reference },
    include: { escrow: true },
  });

  if (!payment) {
    return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
  }

  if (payment.escrow.status === EscrowStatus.FUNDED || payment.status === PaymentStatus.PAID) {
    return NextResponse.json({ ok: true, status: "already_funded" });
  }

  let paid = ["Paid", "Awaiting Delivery", "Delivered"].includes(
    payload.status ?? payload.Status ?? "",
  );

  if (payment.pollUrl) {
    try {
      const polled = await pollPayment(payment.pollUrl);
      paid = polled.paid || paid;
      await prisma.escrowPayment.update({
        where: { id: payment.id },
        data: {
          rawStatus: polled.status || payload.status,
          paynowReference: polled.paynowReference
            ? String(polled.paynowReference)
            : payload.paynowreference ?? payment.paynowReference,
          status: paid ? PaymentStatus.PAID : payment.status,
        },
      });
    } catch (error) {
      console.error("Paynow poll failed", error);
      await prisma.escrowPayment.update({
        where: { id: payment.id },
        data: {
          rawStatus: payload.status ?? payload.Status,
          paynowReference: payload.paynowreference ?? payment.paynowReference,
        },
      });
    }
  }

  if (paid && payment.escrow.status === EscrowStatus.PENDING) {
    await prisma.escrow.update({
      where: { id: payment.escrowId },
      data: { fundingSource: "PAYNOW" },
    });
    await transitionEscrow(payment.escrowId, EscrowStatus.FUNDED, {
      triggeredBy: "paynow_result",
      reason: "Payment confirmed via Paynow result URL",
      metadata: {
        reference,
        status: payload.status ?? payload.Status,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
