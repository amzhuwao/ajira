"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { requireRole } from "@/lib/utils";
import { inviteSchema } from "@/lib/validations";
import type { ActionState } from "./auth";

export async function toggleFavoriteSellerAction(sellerId: string): Promise<ActionState> {
  const session = await requireRole("BUYER", "ADMIN");

  if (sellerId === session.user.id) {
    return { error: "You cannot favorite yourself." };
  }

  const seller = await prisma.user.findFirst({
    where: { id: sellerId, role: "SELLER" },
  });
  if (!seller) return { error: "Seller not found." };

  const existing = await prisma.favoriteSeller.findUnique({
    where: {
      buyerId_sellerId: { buyerId: session.user.id, sellerId },
    },
  });

  if (existing) {
    await prisma.favoriteSeller.delete({ where: { id: existing.id } });
    revalidatePath(`/dashboard/sellers/${sellerId}`);
    revalidatePath("/dashboard/buyer");
    revalidatePath("/dashboard/favorites");
    return { success: "Removed from favorites." };
  }

  await prisma.favoriteSeller.create({
    data: { buyerId: session.user.id, sellerId },
  });
  revalidatePath(`/dashboard/sellers/${sellerId}`);
  revalidatePath("/dashboard/buyer");
  revalidatePath("/dashboard/favorites");
  return { success: "Saved to favorites." };
}

export async function inviteSellerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("BUYER", "ADMIN");

  const parsed = inviteSchema.safeParse({
    projectId: formData.get("projectId"),
    sellerId: formData.get("sellerId"),
    message: formData.get("message") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invite" };
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
  });
  if (!project || project.buyerId !== session.user.id) {
    return { error: "Project not found." };
  }
  if (project.status !== "OPEN") {
    return { error: "You can only invite sellers to open projects." };
  }

  const seller = await prisma.user.findFirst({
    where: { id: parsed.data.sellerId, role: "SELLER", status: "ACTIVE" },
  });
  if (!seller) return { error: "Seller not found." };

  try {
    await prisma.projectInvite.create({
      data: {
        projectId: project.id,
        sellerId: seller.id,
        buyerId: session.user.id,
        message: parsed.data.message || null,
      },
    });
  } catch {
    return { error: "This seller was already invited to this project." };
  }

  await createNotification({
    userId: seller.id,
    type: "INVITE",
    title: `Invite: ${project.title}`,
    body: parsed.data.message || `${session.user.name} invited you to bid.`,
    href: `/dashboard/projects/${project.id}`,
  });

  revalidatePath(`/dashboard/sellers/${seller.id}`);
  revalidatePath(`/dashboard/projects/${project.id}`);
  return { success: "Invite sent." };
}
