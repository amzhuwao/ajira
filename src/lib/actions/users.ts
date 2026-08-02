"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/utils";
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
} from "@/lib/validations";
import type { ActionState } from "@/lib/actions/auth";

async function assertNotLastAdmin(userId: string, nextRole?: Role) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== Role.ADMIN) return;
  if (nextRole && nextRole === Role.ADMIN) return;

  const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
  if (adminCount <= 1) {
    throw new Error("Cannot remove or demote the last admin account.");
  }
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("ADMIN");

  const parsed = adminCreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    phone: formData.get("phone") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      role: parsed.data.role,
      phone: parsed.data.phone || null,
      ...(parsed.data.role === "SELLER" ? { wallet: { create: {} } } : {}),
    },
  });

  try {
    const { sendWelcomeEmail } = await import("@/lib/mail");
    await sendWelcomeEmail({
      to: user.email,
      name: user.name,
      role: user.role,
      tempPassword: parsed.data.password,
    });
  } catch (err) {
    console.error("Welcome email failed", err);
  }

  revalidatePath("/dashboard/admin/users");
  redirect(`/dashboard/admin/users/${user.id}`);
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = adminUpdateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    status: formData.get("status") || "ACTIVE",
    kycVerified: formData.get("kycVerified") === "true" ? "true" : "false",
    phone: formData.get("phone") ?? "",
    password: formData.get("password") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
  });
  if (!target) return { error: "User not found." };

  try {
    await assertNotLastAdmin(target.id, parsed.data.role as Role);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Update blocked." };
  }

  const email = parsed.data.email.toLowerCase();
  if (email !== target.email) {
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash) return { error: "Another account already uses that email." };
  }

  if (parsed.data.role === "SELLER") {
    await prisma.sellerWallet.upsert({
      where: { userId: target.id },
      update: {},
      create: { userId: target.id },
    });
  }

  const data: {
    name: string;
    email: string;
    role: Role;
    status: "ACTIVE" | "SUSPENDED" | "BANNED";
    kycVerified: boolean;
    phone: string | null;
    passwordHash?: string;
  } = {
    name: parsed.data.name,
    email,
    role: parsed.data.role as Role,
    status: parsed.data.status,
    kycVerified: parsed.data.kycVerified === "true",
    phone: parsed.data.phone || null,
  };

  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  await prisma.user.update({
    where: { id: target.id },
    data,
  });

  const { logAdminAction } = await import("@/lib/audit");
  await logAdminAction({
    adminId: session.user.id,
    action: "update_user",
    summary: `Updated user ${target.email}`,
    targetType: "User",
    targetId: target.id,
    oldValue: {
      role: target.role,
      status: target.status,
      kycVerified: target.kycVerified,
    },
    newValue: {
      role: data.role,
      status: data.status,
      kycVerified: data.kycVerified,
    },
  });

  revalidatePath("/dashboard/admin/users");
  revalidatePath(`/dashboard/admin/users/${target.id}`);
  return { success: "User updated." };
}

export async function deleteUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!userId) return { error: "Missing user id." };
  if (confirm !== "DELETE") {
    return { error: 'Type DELETE to confirm account deletion.' };
  }

  if (userId === session.user.id) {
    return { error: "You cannot delete your own account." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          projectsAsBuyer: true,
          bids: true,
          escrowsAsBuyer: true,
          escrowsAsSeller: true,
          withdrawals: true,
          disputesOpened: true,
          services: true,
          reviewsGiven: true,
          reviewsReceived: true,
        },
      },
    },
  });

  if (!target) return { error: "User not found." };

  try {
    await assertNotLastAdmin(target.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delete blocked." };
  }

  const counts = target._count;
  const blockers =
    counts.projectsAsBuyer +
    counts.bids +
    counts.escrowsAsBuyer +
    counts.escrowsAsSeller +
    counts.withdrawals +
    counts.disputesOpened;

  if (blockers > 0) {
    return {
      error:
        "This account has marketplace history (projects, bids, escrows, withdrawals, or disputes) and cannot be deleted. Change their role or email instead.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.disputeMessage.deleteMany({ where: { authorId: userId } });
      await tx.review.deleteMany({
        where: { OR: [{ reviewerId: userId }, { revieweeId: userId }] },
      });
      await tx.service.deleteMany({ where: { sellerId: userId } });
      await tx.escrowTransition.deleteMany({ where: { userId } });
      await tx.walletTransaction.deleteMany({ where: { userId } });
      await tx.sellerWallet.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not delete user due to related records.",
    };
  }

  revalidatePath("/dashboard/admin/users");
  redirect("/dashboard/admin/users");
}
