"use server";

import {
  BidStatus,
  EscrowStatus,
  MilestoneStatus,
  Prisma,
  ProjectStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { formatMoney, requireRole, requireSession } from "@/lib/utils";
import { milestonePlanSchema, orderServiceSchema } from "@/lib/validations";
import { ensureProjectConversation } from "@/lib/messaging";
import type { ActionState } from "./auth";

type MilestoneInput = { title: string; amount: number; description?: string };

function parseMilestonesJson(raw: string): MilestoneInput[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const items: MilestoneInput[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") return null;
      const title = String((item as { title?: unknown }).title ?? "").trim();
      const amount = Number((item as { amount?: unknown }).amount);
      const description = String((item as { description?: unknown }).description ?? "").trim();
      if (!title || !Number.isFinite(amount) || amount <= 0) return null;
      items.push({ title, amount, description: description || undefined });
    }
    return items;
  } catch {
    return null;
  }
}

export async function setMilestonesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("BUYER", "ADMIN");

  const parsed = milestonePlanSchema.safeParse({
    escrowId: formData.get("escrowId"),
    milestonesJson: formData.get("milestonesJson"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid milestones" };
  }

  const milestones = parseMilestonesJson(parsed.data.milestonesJson);
  if (!milestones || milestones.length === 0) {
    return { error: "Provide at least one milestone with title and amount." };
  }

  const escrow = await prisma.escrow.findUnique({
    where: { id: parsed.data.escrowId },
    include: { milestones: true, project: true },
  });
  if (!escrow || escrow.buyerId !== session.user.id) {
    return { error: "Escrow not found." };
  }
  if (escrow.status !== EscrowStatus.PENDING && escrow.status !== EscrowStatus.FUNDED) {
    return { error: "Milestones can only be set before release." };
  }
  if (escrow.milestones.some((m) => m.status === MilestoneStatus.RELEASED)) {
    return { error: "Cannot rewrite milestones after a release." };
  }

  const total = milestones.reduce((sum, m) => sum + m.amount, 0);
  if (Math.abs(total - Number(escrow.amount)) > 0.01) {
    return {
      error: `Milestone amounts must total ${formatMoney(escrow.amount)} (got ${formatMoney(total)}).`,
    };
  }

  const funded = escrow.status === EscrowStatus.FUNDED;
  await prisma.$transaction(async (tx) => {
    await tx.milestone.deleteMany({ where: { escrowId: escrow.id } });
    await tx.milestone.createMany({
      data: milestones.map((m, index) => ({
        escrowId: escrow.id,
        title: m.title,
        description: m.description ?? null,
        amount: m.amount,
        orderIndex: index,
        status: funded ? MilestoneStatus.FUNDED : MilestoneStatus.PENDING,
        fundedAt: funded ? new Date() : null,
      })),
    });
  });

  await createNotification({
    userId: escrow.sellerId,
    type: "MILESTONE",
    title: `Milestones set for ${escrow.project.title}`,
    body: `${milestones.length} milestone(s) totaling ${formatMoney(escrow.amount)}.`,
    href: `/dashboard/escrow/${escrow.id}`,
  });

  revalidatePath(`/dashboard/escrow/${escrow.id}`);
  revalidatePath(`/dashboard/projects/${escrow.projectId}`);
  return { success: "Milestones saved." };
}

export async function markMilestoneDeliveredAction(milestoneId: string): Promise<ActionState> {
  const session = await requireSession();

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      escrow: { include: { project: true, buyer: { select: { email: true, name: true } } } },
    },
  });
  if (!milestone || milestone.escrow.sellerId !== session.user.id) {
    return { error: "Not authorized." };
  }
  if (milestone.escrow.status !== EscrowStatus.FUNDED) {
    return { error: "Escrow must be funded." };
  }
  if (milestone.status !== MilestoneStatus.FUNDED && milestone.status !== MilestoneStatus.PENDING) {
    return { error: "Milestone is not ready for delivery." };
  }

  const earlierPending = await prisma.milestone.findFirst({
    where: {
      escrowId: milestone.escrowId,
      orderIndex: { lt: milestone.orderIndex },
      status: { not: MilestoneStatus.RELEASED },
    },
  });
  if (earlierPending) {
    return { error: "Complete earlier milestones first." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.milestone.update({
      where: { id: milestone.id },
      data: {
        status: MilestoneStatus.DELIVERED,
        deliveredAt: new Date(),
        fundedAt: milestone.fundedAt ?? new Date(),
      },
    });
    await tx.project.update({
      where: { id: milestone.escrow.projectId },
      data: { status: ProjectStatus.DELIVERED, deliveredAt: new Date() },
    });
  });

  await createNotification({
    userId: milestone.escrow.buyerId,
    type: "MILESTONE",
    title: `Milestone delivered: ${milestone.title}`,
    body: milestone.escrow.project.title,
    href: `/dashboard/escrow/${milestone.escrowId}`,
  });

  try {
    const { sendWorkDeliveredEmail } = await import("@/lib/mail");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ajira.online";
    await sendWorkDeliveredEmail({
      to: milestone.escrow.buyer.email,
      name: milestone.escrow.buyer.name,
      projectTitle: `${milestone.escrow.project.title} — ${milestone.title}`,
      projectUrl: `${appUrl}/dashboard/escrow/${milestone.escrowId}`,
    });
  } catch (err) {
    console.error("Milestone delivered email failed", err);
  }

  revalidatePath(`/dashboard/escrow/${milestone.escrowId}`);
  revalidatePath(`/dashboard/projects/${milestone.escrow.projectId}`);
  return { success: "Milestone marked delivered." };
}

export async function approveMilestoneAction(milestoneId: string): Promise<ActionState> {
  const session = await requireRole("BUYER", "ADMIN");
  const { transitionEscrow } = await import("@/lib/escrow");
  const { creditEarnings } = await import("@/lib/wallet");

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      escrow: {
        include: {
          project: true,
          milestones: { orderBy: { orderIndex: "asc" } },
          buyer: { select: { email: true, name: true } },
          seller: { select: { email: true, name: true } },
        },
      },
    },
  });

  if (!milestone || milestone.escrow.buyerId !== session.user.id) {
    return { error: "Milestone not found." };
  }
  if (milestone.status !== MilestoneStatus.DELIVERED) {
    return { error: "Seller must mark the milestone delivered first." };
  }
  if (milestone.escrow.status !== EscrowStatus.FUNDED) {
    return { error: "Escrow is not funded." };
  }

  const remaining = milestone.escrow.milestones.filter(
    (m) => m.id !== milestone.id && m.status !== MilestoneStatus.RELEASED,
  );
  const isLast = remaining.length === 0;

  await prisma.$transaction(async (tx) => {
    await creditEarnings({
      userId: milestone.escrow.sellerId,
      amount: milestone.amount,
      escrowId: milestone.escrowId,
      description: `Milestone: ${milestone.title} (${milestone.escrow.project.title})`,
      applyCommission: true,
      tx,
    });

    await tx.milestone.update({
      where: { id: milestone.id },
      data: { status: MilestoneStatus.RELEASED, releasedAt: new Date() },
    });

    await tx.escrow.update({
      where: { id: milestone.escrowId },
      data: { releasedAmount: { increment: milestone.amount } },
    });

    if (isLast) {
      await transitionEscrow(milestone.escrowId, EscrowStatus.RELEASE_REQUESTED, {
        triggeredBy: "buyer",
        userId: session.user.id,
        reason: "Final milestone approved",
        tx,
      });
      await transitionEscrow(milestone.escrowId, EscrowStatus.RELEASED, {
        triggeredBy: "system",
        userId: session.user.id,
        reason: "All milestones released",
        tx,
      });
      await tx.project.update({
        where: { id: milestone.escrow.projectId },
        data: { status: ProjectStatus.COMPLETED, completedAt: new Date() },
      });
    } else {
      await tx.project.update({
        where: { id: milestone.escrow.projectId },
        data: { status: ProjectStatus.IN_PROGRESS, deliveredAt: null },
      });
    }
  });

  await createNotification({
    userId: milestone.escrow.sellerId,
    type: "ESCROW_RELEASED",
    title: isLast ? "Project completed — funds released" : `Milestone approved: ${milestone.title}`,
    body: `${formatMoney(milestone.amount)} credited for ${milestone.escrow.project.title}.`,
    href: `/dashboard/wallet`,
  });

  if (isLast) {
    try {
      const { sendEscrowReleasedEmail } = await import("@/lib/mail");
      await sendEscrowReleasedEmail({
        sellerEmail: milestone.escrow.seller.email,
        sellerName: milestone.escrow.seller.name,
        buyerEmail: milestone.escrow.buyer.email,
        buyerName: milestone.escrow.buyer.name,
        projectTitle: milestone.escrow.project.title,
        amount: formatMoney(Number(milestone.escrow.amount)),
      });
    } catch (err) {
      console.error("Escrow released email failed", err);
    }
    try {
      const { refreshSellerStatistics } = await import("@/lib/stats");
      await refreshSellerStatistics(milestone.escrow.sellerId);
    } catch (err) {
      console.error("Stats refresh failed", err);
    }
  }

  revalidatePath(`/dashboard/escrow/${milestone.escrowId}`);
  revalidatePath(`/dashboard/projects/${milestone.escrow.projectId}`);
  revalidatePath("/dashboard/wallet");
  return {
    success: isLast
      ? "Final milestone approved. Project completed."
      : "Milestone approved. Funds released for this phase.",
  };
}

export async function orderServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("BUYER", "ADMIN");

  const parsed = orderServiceSchema.safeParse({
    serviceId: formData.get("serviceId"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }

  const service = await prisma.service.findUnique({
    where: { id: parsed.data.serviceId },
    include: { seller: { select: { id: true, name: true, email: true, status: true } } },
  });
  if (!service || service.status !== "ACTIVE") {
    return { error: "Service is not available." };
  }
  if (service.sellerId === session.user.id) {
    return { error: "You cannot order your own service." };
  }
  if (service.seller.status !== "ACTIVE") {
    return { error: "This seller is not currently available." };
  }

  const description = [
    service.description,
    service.deliverables ? `\n\nDeliverables:\n${service.deliverables}` : "",
    parsed.data.notes ? `\n\nBuyer notes:\n${parsed.data.notes}` : "",
  ]
    .join("")
    .trim();

  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        title: service.title,
        description,
        budgetMin: service.price,
        budgetMax: service.price,
        category: service.category,
        timeline: "SHORT",
        buyerId: session.user.id,
        serviceId: service.id,
        status: ProjectStatus.IN_PROGRESS,
      },
    });

    const bid = await tx.bid.create({
      data: {
        projectId: project.id,
        sellerId: service.sellerId,
        amount: service.price,
        proposal: `Catalog order: ${service.title}`,
        deliveryDays: service.deliveryDays,
        status: BidStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    });

    await tx.project.update({
      where: { id: project.id },
      data: { acceptedBidId: bid.id },
    });

    const escrow = await tx.escrow.create({
      data: {
        projectId: project.id,
        bidId: bid.id,
        buyerId: session.user.id,
        sellerId: service.sellerId,
        amount: service.price,
        status: EscrowStatus.PENDING,
        milestones: {
          create: {
            title: "Delivery",
            description: service.deliverables,
            amount: service.price,
            orderIndex: 0,
            status: MilestoneStatus.PENDING,
          },
        },
      },
    });

    await ensureProjectConversation({
      projectId: project.id,
      participantIds: [session.user.id, service.sellerId],
      tx,
    });

    return { project, escrow };
  });

  await createNotification({
    userId: service.sellerId,
    type: "ORDER",
    title: `New catalog order: ${service.title}`,
    body: `${session.user.name} ordered your service for ${formatMoney(service.price)}.`,
    href: `/dashboard/escrow/${result.escrow.id}`,
  });

  redirect(`/dashboard/escrow/${result.escrow.id}`);
}

/** Sync milestone FUNDED status when escrow becomes funded (called from payment flow). */
export async function markMilestonesFunded(escrowId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  await client.milestone.updateMany({
    where: { escrowId, status: MilestoneStatus.PENDING },
    data: { status: MilestoneStatus.FUNDED, fundedAt: new Date() },
  });
}
