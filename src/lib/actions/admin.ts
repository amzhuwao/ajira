"use server";

import { EscrowStatus, ProjectStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/utils";
import { platformSettingsSchema } from "@/lib/validations";
import { ensureDefaultSettings, setSetting } from "@/lib/settings";
import { logAdminAction } from "@/lib/audit";
import { refreshSellerStatistics } from "@/lib/stats";
import { creditEarnings, getOrCreateWallet } from "@/lib/wallet";
import { transitionEscrow } from "@/lib/escrow";
import type { ActionState } from "./auth";

export async function updatePlatformSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = platformSettingsSchema.safeParse({
    commission_percentage: formData.get("commission_percentage"),
    refund_fee_percentage: formData.get("refund_fee_percentage"),
    min_escrow_amount: formData.get("min_escrow_amount"),
    max_transaction_amount: formData.get("max_transaction_amount"),
    auto_release_days: formData.get("auto_release_days"),
    dispute_resolution_days: formData.get("dispute_resolution_days"),
    kyc_required_for_seller: formData.get("kyc_required_for_seller"),
    maintenance_mode: formData.get("maintenance_mode"),
    tos_text: formData.get("tos_text"),
    privacy_text: formData.get("privacy_text"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  await ensureDefaultSettings();

  for (const [key, value] of Object.entries(parsed.data)) {
    await setSetting(key, String(value));
  }

  await logAdminAction({
    adminId: session.user.id,
    action: "update_settings",
    summary: "Updated platform settings",
    targetType: "PlatformSetting",
    newValue: parsed.data,
  });

  revalidatePath("/dashboard/admin/settings");
  return { success: "Settings saved." };
}

export async function refreshStatsAction(): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  await refreshSellerStatistics();
  await logAdminAction({
    adminId: session.user.id,
    action: "refresh_stats",
    summary: "Refreshed seller statistics",
  });
  revalidatePath("/dashboard/admin");
  return { success: "Seller statistics refreshed." };
}

export async function cancelProjectAction(projectId: string): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { escrow: true },
  });
  if (!project) return { error: "Project not found." };

  if (project.escrow && ["FUNDED", "RELEASE_REQUESTED", "DISPUTED"].includes(project.escrow.status)) {
    return { error: "Cancel the escrow/dispute first before cancelling this project." };
  }

  await prisma.$transaction(async (tx) => {
    if (project.escrow && project.escrow.status === EscrowStatus.PENDING) {
      await transitionEscrow(project.escrow.id, EscrowStatus.CANCELED, {
        triggeredBy: "admin",
        userId: session.user.id,
        reason: "Project cancelled by admin",
        tx,
      });
    }
    await tx.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.CANCELLED },
    });
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "cancel_project",
    summary: `Cancelled project ${project.title}`,
    targetType: "Project",
    targetId: projectId,
  });

  revalidatePath("/dashboard/admin/projects");
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: "Project cancelled." };
}

export async function reassignSellerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const projectId = String(formData.get("projectId") ?? "");
  const sellerId = String(formData.get("sellerId") ?? "");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { escrow: true, acceptedBid: true },
  });
  if (!project) return { error: "Project not found." };
  if (!project.acceptedBid || !project.escrow) {
    return { error: "Project has no accepted bid/escrow to reassign." };
  }
  if (project.escrow.status !== EscrowStatus.PENDING) {
    return { error: "Can only reassign before escrow is funded." };
  }

  const seller = await prisma.user.findFirst({
    where: { id: sellerId, role: "SELLER", status: "ACTIVE" },
  });
  if (!seller) return { error: "Active seller not found." };

  await prisma.$transaction(async (tx) => {
    await tx.bid.update({
      where: { id: project.acceptedBid!.id },
      data: { sellerId: seller.id },
    });
    await tx.escrow.update({
      where: { id: project.escrow!.id },
      data: { sellerId: seller.id },
    });
  });

  await logAdminAction({
    adminId: session.user.id,
    action: "reassign_seller",
    summary: `Reassigned project ${projectId} to seller ${seller.email}`,
    targetType: "Project",
    targetId: projectId,
    oldValue: { sellerId: project.escrow.sellerId },
    newValue: { sellerId: seller.id },
  });

  revalidatePath("/dashboard/admin/projects");
  return { success: `Reassigned to ${seller.name}.` };
}

export async function walletBackfillAction(): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const released = await prisma.escrow.findMany({
    where: { status: EscrowStatus.RELEASED },
    include: {
      project: true,
      walletTxns: { where: { type: "CREDIT" } },
    },
  });

  let credited = 0;
  for (const escrow of released) {
    if (escrow.walletTxns.length > 0) continue;
    const net = new Prisma.Decimal(escrow.amount).minus(escrow.feeAmount ?? 0);
    if (net.lte(0)) continue;

    await creditEarnings({
      userId: escrow.sellerId,
      amount: net,
      escrowId: escrow.id,
      description: `Backfill: ${escrow.project.title}`,
      applyCommission: false,
    });
    credited += 1;
  }

  await logAdminAction({
    adminId: session.user.id,
    action: "wallet_backfill",
    summary: `Backfilled wallet credits for ${credited} escrows`,
    newValue: { credited },
  });

  revalidatePath("/dashboard/admin/financials");
  revalidatePath("/dashboard/admin");
  return { success: `Backfilled ${credited} missing wallet credit(s).` };
}

export async function ensureSellerWalletsAction(): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const sellers = await prisma.user.findMany({
    where: { role: "SELLER", wallet: null },
    select: { id: true },
  });
  for (const s of sellers) {
    await getOrCreateWallet(s.id);
  }
  await logAdminAction({
    adminId: session.user.id,
    action: "ensure_wallets",
    summary: `Created ${sellers.length} missing seller wallets`,
  });
  return { success: `Ensured wallets for ${sellers.length} seller(s).` };
}
