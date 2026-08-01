"use server";

import { BidStatus, EscrowStatus, ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/utils";
import { bidSchema, projectSchema } from "@/lib/validations";
import type { ActionState } from "./auth";

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("BUYER", "ADMIN");

  const parsed = projectSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    budgetMin: formData.get("budgetMin"),
    budgetMax: formData.get("budgetMax"),
    category: formData.get("category"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid project" };
  }

  const project = await prisma.project.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      budgetMin: parsed.data.budgetMin,
      budgetMax: parsed.data.budgetMax,
      category: parsed.data.category || null,
      buyerId: session.user.id,
      status: ProjectStatus.OPEN,
    },
  });

  redirect(`/dashboard/projects/${project.id}`);
}

export async function placeBidAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("SELLER");

  const parsed = bidSchema.safeParse({
    projectId: formData.get("projectId"),
    amount: formData.get("amount"),
    proposal: formData.get("proposal"),
    deliveryDays: formData.get("deliveryDays"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bid" };
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
  });

  if (!project || project.status !== ProjectStatus.OPEN) {
    return { error: "This project is not open for bids." };
  }

  if (project.buyerId === session.user.id) {
    return { error: "You cannot bid on your own project." };
  }

  try {
    await prisma.bid.create({
      data: {
        projectId: parsed.data.projectId,
        sellerId: session.user.id,
        amount: parsed.data.amount,
        proposal: parsed.data.proposal,
        deliveryDays: parsed.data.deliveryDays,
      },
    });
  } catch {
    return { error: "You already placed a bid on this project." };
  }

  revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);
  return { success: "Bid submitted." };
}

export async function acceptBidAction(bidId: string): Promise<ActionState> {
  const session = await requireRole("BUYER", "ADMIN");

  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: { project: true },
  });

  if (!bid || bid.project.buyerId !== session.user.id) {
    return { error: "Bid not found." };
  }

  if (bid.project.status !== ProjectStatus.OPEN) {
    return { error: "Project is not open." };
  }

  const escrow = await prisma.$transaction(async (tx) => {
    await tx.bid.update({
      where: { id: bid.id },
      data: { status: BidStatus.ACCEPTED },
    });

    await tx.bid.updateMany({
      where: {
        projectId: bid.projectId,
        id: { not: bid.id },
        status: BidStatus.PENDING,
      },
      data: { status: BidStatus.REJECTED },
    });

    await tx.project.update({
      where: { id: bid.projectId },
      data: {
        status: ProjectStatus.IN_PROGRESS,
      },
    });

    return tx.escrow.create({
      data: {
        projectId: bid.projectId,
        bidId: bid.id,
        buyerId: bid.project.buyerId,
        sellerId: bid.sellerId,
        amount: bid.amount,
        status: EscrowStatus.PENDING,
      },
    });
  });

  redirect(`/dashboard/escrow/${escrow.id}`);
}

export async function markDeliveredAction(projectId: string): Promise<ActionState> {
  const session = await requireSession();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { escrow: true },
  });

  if (!project?.escrow || project.escrow.sellerId !== session.user.id) {
    return { error: "Not authorized." };
  }

  if (project.escrow.status !== EscrowStatus.FUNDED) {
    return { error: "Escrow must be funded before delivery." };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { status: ProjectStatus.DELIVERED, deliveredAt: new Date() },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/escrow/${project.escrow.id}`);
  return { success: "Marked as delivered." };
}

export async function approveWorkAction(escrowId: string): Promise<ActionState> {
  const session = await requireRole("BUYER", "ADMIN");
  const { transitionEscrow } = await import("@/lib/escrow");
  const { creditEarnings } = await import("@/lib/wallet");

  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: { project: true },
  });

  if (!escrow || escrow.buyerId !== session.user.id) {
    return { error: "Escrow not found." };
  }

  if (escrow.status !== EscrowStatus.FUNDED) {
    return { error: "Escrow is not in a fundable release state." };
  }

  if (escrow.project.status !== ProjectStatus.DELIVERED) {
    return { error: "Seller must mark work as delivered first." };
  }

  await prisma.$transaction(async (tx) => {
    await transitionEscrow(escrowId, EscrowStatus.RELEASE_REQUESTED, {
      triggeredBy: "buyer",
      userId: session.user.id,
      reason: "Buyer approved delivered work",
      tx,
    });

    await creditEarnings({
      userId: escrow.sellerId,
      amount: escrow.amount,
      escrowId: escrow.id,
      description: `Earnings for ${escrow.project.title}`,
      tx,
    });

    await transitionEscrow(escrowId, EscrowStatus.RELEASED, {
      triggeredBy: "system",
      userId: session.user.id,
      reason: "Wallet credited after buyer approval",
      tx,
    });
  });

  revalidatePath(`/dashboard/escrow/${escrowId}`);
  revalidatePath("/dashboard/wallet");
  return { success: "Work approved. Funds released to seller wallet." };
}
