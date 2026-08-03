"use server";

import { DisputeStatus, EscrowStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/utils";
import {
  disputeMessageSchema,
  disputeSchema,
  disputeSplitSchema,
} from "@/lib/validations";
import { transitionEscrow } from "@/lib/escrow";
import { creditEarnings, creditEscrowRefund } from "@/lib/wallet";
import { logAdminAction } from "@/lib/audit";
import type { ActionState } from "./auth";

async function notifyDisputeOpened(disputeId: string, projectTitle: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      escrow: {
        include: {
          buyer: { select: { email: true, name: true } },
          seller: { select: { email: true, name: true } },
        },
      },
    },
  });
  if (!dispute) return;
  const { sendDisputeOpenedEmail } = await import("@/lib/mail");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ajira.online";
  await sendDisputeOpenedEmail({
    parties: [dispute.escrow.buyer, dispute.escrow.seller],
    projectTitle,
    disputeUrl: `${appUrl}/dashboard/disputes/${disputeId}`,
  });
}

async function notifyDisputeResolved(
  disputeId: string,
  projectTitle: string,
  resolution: string,
) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      escrow: {
        include: {
          buyer: { select: { email: true, name: true } },
          seller: { select: { email: true, name: true } },
        },
      },
    },
  });
  if (!dispute) return;
  const { sendDisputeResolvedEmail } = await import("@/lib/mail");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ajira.online";
  await sendDisputeResolvedEmail({
    parties: [dispute.escrow.buyer, dispute.escrow.seller],
    projectTitle,
    resolution,
    disputeUrl: `${appUrl}/dashboard/disputes/${disputeId}`,
  });
}

export async function openDisputeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const parsed = disputeSchema.safeParse({
    escrowId: formData.get("escrowId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid dispute" };
  }

  const escrow = await prisma.escrow.findUnique({
    where: { id: parsed.data.escrowId },
    include: { project: true },
  });

  if (!escrow) return { error: "Escrow not found." };

  const isParty =
    escrow.buyerId === session.user.id || escrow.sellerId === session.user.id;
  if (!isParty && session.user.role !== "ADMIN") {
    return { error: "Not authorized." };
  }

  const disputable: EscrowStatus[] = [
    EscrowStatus.FUNDED,
    EscrowStatus.RELEASE_REQUESTED,
    EscrowStatus.REFUND_REQUESTED,
  ];
  if (!disputable.includes(escrow.status)) {
    return { error: "Disputes can only be opened on active funded escrows." };
  }

  const dispute = await prisma.$transaction(async (tx) => {
    await transitionEscrow(escrow.id, EscrowStatus.DISPUTED, {
      triggeredBy: "user",
      userId: session.user.id,
      reason: parsed.data.reason,
      tx,
    });

    return tx.dispute.create({
      data: {
        escrowId: escrow.id,
        openedById: session.user.id,
        reason: parsed.data.reason,
        status: DisputeStatus.OPEN,
        messages: {
          create: {
            authorId: session.user.id,
            body: parsed.data.reason,
          },
        },
      },
    });
  });

  try {
    await notifyDisputeOpened(dispute.id, escrow.project.title);
  } catch (err) {
    console.error("Dispute opened email failed", err);
  }

  redirect(`/dashboard/disputes/${dispute.id}`);
}

export async function addDisputeMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const parsed = disputeMessageSchema.safeParse({
    disputeId: formData.get("disputeId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message" };
  }

  const dispute = await prisma.dispute.findUnique({
    where: { id: parsed.data.disputeId },
    include: { escrow: true },
  });

  if (!dispute) return { error: "Dispute not found." };

  const isParty =
    dispute.escrow.buyerId === session.user.id ||
    dispute.escrow.sellerId === session.user.id ||
    session.user.role === "ADMIN";

  if (!isParty) return { error: "Not authorized." };

  await prisma.disputeMessage.create({
    data: {
      disputeId: dispute.id,
      authorId: session.user.id,
      body: parsed.data.body,
    },
  });

  if (dispute.status === DisputeStatus.OPEN && session.user.role === "ADMIN") {
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { status: DisputeStatus.UNDER_REVIEW },
    });
  }

  revalidatePath(`/dashboard/disputes/${dispute.id}`);
  return { success: "Message added." };
}

export async function uploadEvidenceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const disputeId = String(formData.get("disputeId") ?? "");
  const file = formData.get("file");

  if (!disputeId || !(file instanceof File) || file.size === 0) {
    return { error: "File is required." };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "File must be under 5MB." };
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) {
    return { error: "Only JPEG, PNG, WebP, or PDF allowed." };
  }

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { escrow: true, evidence: true },
  });

  if (!dispute) return { error: "Dispute not found." };
  if (dispute.evidence.length >= 5) {
    return { error: "Maximum 5 evidence files per dispute." };
  }

  const isParty =
    dispute.escrow.buyerId === session.user.id ||
    dispute.escrow.sellerId === session.user.id ||
    session.user.role === "ADMIN";
  if (!isParty) return { error: "Not authorized." };

  const uploadDir = path.join(process.cwd(), "public", "uploads", "dispute_evidence");
  await mkdir(uploadDir, { recursive: true });

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(uploadDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  await prisma.disputeEvidence.create({
    data: {
      disputeId,
      uploadedById: session.user.id,
      fileName: file.name,
      filePath: `/uploads/dispute_evidence/${safeName}`,
      mimeType: file.type,
    },
  });

  revalidatePath(`/dashboard/disputes/${disputeId}`);
  return { success: "Evidence uploaded." };
}

export async function resolveDisputeAction(
  disputeId: string,
  resolution: "RELEASE" | "REFUND",
  note: string,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { escrow: { include: { project: true } } },
  });

  if (!dispute || dispute.escrow.status !== EscrowStatus.DISPUTED) {
    return { error: "Dispute not open." };
  }

  await prisma.$transaction(async (tx) => {
    if (resolution === "RELEASE") {
      await transitionEscrow(dispute.escrowId, EscrowStatus.RELEASED, {
        triggeredBy: "admin",
        userId: session.user.id,
        reason: note,
        tx,
      });

      await creditEarnings({
        userId: dispute.escrow.sellerId,
        amount: dispute.escrow.amount,
        escrowId: dispute.escrowId,
        description: `Dispute release: ${dispute.escrow.project.title}`,
        applyCommission: true,
        tx,
      });

      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: DisputeStatus.RESOLVED_RELEASE,
          resolution: note,
          resolvedAt: new Date(),
          sellerShareAmount: dispute.escrow.amount,
          buyerShareAmount: 0,
        },
      });
    } else {
      await transitionEscrow(dispute.escrowId, EscrowStatus.REFUNDED, {
        triggeredBy: "admin",
        userId: session.user.id,
        reason: note,
        tx,
      });

      if (dispute.escrow.fundingSource === "WALLET") {
        await creditEscrowRefund({
          userId: dispute.escrow.buyerId,
          amount: dispute.escrow.amount,
          escrowId: dispute.escrowId,
          description: `Dispute refund to wallet: ${dispute.escrow.project.title}`,
          tx,
        });
      }

      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: DisputeStatus.RESOLVED_REFUND,
          resolution:
            dispute.escrow.fundingSource === "WALLET"
              ? note
              : `${note}\n\nManual Paynow refund required in merchant dashboard for reference on this escrow.`,
          resolvedAt: new Date(),
          buyerShareAmount: dispute.escrow.amount,
          sellerShareAmount: 0,
        },
      });
    }
  });

  await logAdminAction({
    adminId: session.user.id,
    action: resolution === "RELEASE" ? "dispute_release" : "dispute_refund",
    summary: `Resolved dispute ${disputeId} via ${resolution}`,
    targetType: "Dispute",
    targetId: disputeId,
    newValue: { resolution, note },
  });

  try {
    await notifyDisputeResolved(disputeId, dispute.escrow.project.title, resolution);
  } catch (err) {
    console.error("Dispute resolved email failed", err);
  }

  revalidatePath(`/dashboard/disputes/${disputeId}`);
  revalidatePath("/dashboard/admin");
  return { success: `Dispute resolved via ${resolution}.` };
}

export async function resolveDisputeSplitAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = disputeSplitSchema.safeParse({
    disputeId: formData.get("disputeId"),
    buyerSharePercent: formData.get("buyerSharePercent"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid split" };
  }

  const dispute = await prisma.dispute.findUnique({
    where: { id: parsed.data.disputeId },
    include: { escrow: { include: { project: true } } },
  });

  if (!dispute || dispute.escrow.status !== EscrowStatus.DISPUTED) {
    return { error: "Dispute not open." };
  }

  const total = Number(dispute.escrow.amount);
  const buyerShare =
    Math.round(total * (parsed.data.buyerSharePercent / 100) * 100) / 100;
  const sellerShare = Math.round((total - buyerShare) * 100) / 100;

  await prisma.$transaction(async (tx) => {
    if (sellerShare > 0) {
      await creditEarnings({
        userId: dispute.escrow.sellerId,
        amount: sellerShare,
        escrowId: dispute.escrowId,
        description: `Dispute split (seller share): ${dispute.escrow.project.title}`,
        applyCommission: false,
        tx,
      });
    }

    if (buyerShare > 0 && dispute.escrow.fundingSource === "WALLET") {
      await creditEscrowRefund({
        userId: dispute.escrow.buyerId,
        amount: buyerShare,
        escrowId: dispute.escrowId,
        description: `Dispute split (buyer share): ${dispute.escrow.project.title}`,
        tx,
      });
    }

    await transitionEscrow(dispute.escrowId, EscrowStatus.RELEASED, {
      triggeredBy: "admin",
      userId: session.user.id,
      reason: `Split resolution: buyer ${buyerShare}, seller ${sellerShare}`,
      tx,
      metadata: { buyerShare, sellerShare },
    });

    const buyerRefundNote =
      dispute.escrow.fundingSource === "WALLET"
        ? `buyer $${buyerShare.toFixed(2)} restored to wallet`
        : `buyer $${buyerShare.toFixed(2)} (refund manually in Paynow)`;

    await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status: DisputeStatus.RESOLVED_SPLIT,
        resolution: `${parsed.data.note}\n\nSplit: ${buyerRefundNote}, seller $${sellerShare.toFixed(2)} credited to wallet.`,
        buyerShareAmount: new Prisma.Decimal(buyerShare),
        sellerShareAmount: new Prisma.Decimal(sellerShare),
        resolvedAt: new Date(),
      },
    });
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "dispute_split",
    summary: `Split dispute ${dispute.id}: buyer ${buyerShare}, seller ${sellerShare}`,
    targetType: "Dispute",
    targetId: dispute.id,
    newValue: { buyerShare, sellerShare, note: parsed.data.note },
  });

  try {
    await notifyDisputeResolved(dispute.id, dispute.escrow.project.title, "SPLIT");
  } catch (err) {
    console.error("Dispute split email failed", err);
  }

  revalidatePath(`/dashboard/disputes/${dispute.id}`);
  revalidatePath("/dashboard/admin");
  return { success: "Dispute resolved with split." };
}

export async function adminMarkEscrowDisputedAction(escrowId: string): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: { project: true, dispute: true },
  });

  if (!escrow) return { error: "Escrow not found." };
  if (escrow.dispute) return { error: "Dispute already exists." };

  const disputable: EscrowStatus[] = [
    EscrowStatus.FUNDED,
    EscrowStatus.RELEASE_REQUESTED,
    EscrowStatus.REFUND_REQUESTED,
  ];
  if (!disputable.includes(escrow.status)) {
    return { error: "Escrow cannot be marked disputed in its current state." };
  }

  const dispute = await prisma.$transaction(async (tx) => {
    await transitionEscrow(escrow.id, EscrowStatus.DISPUTED, {
      triggeredBy: "admin",
      userId: session.user.id,
      reason: "Admin marked escrow as disputed",
      tx,
    });

    return tx.dispute.create({
      data: {
        escrowId: escrow.id,
        openedById: session.user.id,
        reason: "Admin opened dispute for review.",
        status: DisputeStatus.UNDER_REVIEW,
        messages: {
          create: {
            authorId: session.user.id,
            body: "Admin opened this dispute for review.",
          },
        },
      },
    });
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "mark_escrow_disputed",
    summary: `Marked escrow ${escrowId} disputed`,
    targetType: "Escrow",
    targetId: escrowId,
  });

  revalidatePath(`/dashboard/escrow/${escrowId}`);
  revalidatePath(`/dashboard/disputes/${dispute.id}`);
  redirect(`/dashboard/disputes/${dispute.id}`);
}
