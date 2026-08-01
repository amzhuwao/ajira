"use server";

import { DisputeStatus, EscrowStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/utils";
import { disputeMessageSchema, disputeSchema } from "@/lib/validations";
import { transitionEscrow } from "@/lib/escrow";
import { creditEarnings } from "@/lib/wallet";
import type { ActionState } from "./auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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
    include: { escrow: true },
  });

  if (!dispute) return { error: "Dispute not found." };

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
        tx,
      });

      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: DisputeStatus.RESOLVED_RELEASE,
          resolution: note,
          resolvedAt: new Date(),
        },
      });
    } else {
      await transitionEscrow(dispute.escrowId, EscrowStatus.REFUNDED, {
        triggeredBy: "admin",
        userId: session.user.id,
        reason: note,
        tx,
      });

      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: DisputeStatus.RESOLVED_REFUND,
          resolution:
            `${note}\n\nManual Paynow refund required in merchant dashboard for reference on this escrow.`,
          resolvedAt: new Date(),
        },
      });
    }
  });

  revalidatePath(`/dashboard/disputes/${disputeId}`);
  revalidatePath("/dashboard/admin");
  return { success: `Dispute resolved via ${resolution}.` };
}
