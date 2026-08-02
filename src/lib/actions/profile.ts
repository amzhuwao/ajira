"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/utils";
import {
  changePasswordSchema,
  sellerProfileSchema,
  serviceSchema,
} from "@/lib/validations";
import type { ActionState } from "./auth";

function profileCompletion(user: {
  tagline: string | null;
  bio: string | null;
  skills: string | null;
  profileImageUrl: string | null;
  phone: string | null;
}) {
  const fields = [
    user.tagline,
    user.bio,
    user.skills,
    user.profileImageUrl,
    user.phone,
  ];
  const filled = fields.filter((f) => f && String(f).trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

export async function updateSellerProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("SELLER", "ADMIN");

  const parsed = sellerProfileSchema.safeParse({
    tagline: formData.get("tagline") ?? "",
    bio: formData.get("bio") ?? "",
    skills: formData.get("skills") ?? "",
    availability: formData.get("availability") || "AVAILABLE",
    profileImageUrl: formData.get("profileImageUrl") ?? "",
    coverImageUrl: formData.get("coverImageUrl") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      tagline: parsed.data.tagline || null,
      bio: parsed.data.bio || null,
      skills: parsed.data.skills || null,
      availability: parsed.data.availability,
      profileImageUrl: parsed.data.profileImageUrl || null,
      coverImageUrl: parsed.data.coverImageUrl || null,
    },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath(`/dashboard/sellers/${session.user.id}`);
  return {
    success: `Profile saved. Completion: ${profileCompletion({
      tagline: parsed.data.tagline || null,
      bio: parsed.data.bio || null,
      skills: parsed.data.skills || null,
      profileImageUrl: parsed.data.profileImageUrl || null,
      phone: null,
    })}% (phone counted separately).`,
  };
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "User not found." };

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return { success: "Password updated." };
}

export async function createServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("SELLER");

  const parsed = serviceSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    category: formData.get("category") ?? "",
    deliveryDays: formData.get("deliveryDays") || 7,
    deliverables: formData.get("deliverables") ?? "",
    status: formData.get("status") || "ACTIVE",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid service" };
  }

  await prisma.service.create({
    data: {
      sellerId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      category: parsed.data.category || null,
      deliveryDays: parsed.data.deliveryDays,
      deliverables: parsed.data.deliverables || null,
      status: parsed.data.status,
    },
  });

  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/catalog");
  revalidatePath(`/dashboard/sellers/${session.user.id}`);
  return { success: "Service created." };
}

export async function updateServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("SELLER");
  const serviceId = String(formData.get("serviceId") ?? "");

  const parsed = serviceSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    category: formData.get("category") ?? "",
    deliveryDays: formData.get("deliveryDays") || 7,
    deliverables: formData.get("deliverables") ?? "",
    status: formData.get("status") || "ACTIVE",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid service" };
  }

  const existing = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!existing || existing.sellerId !== session.user.id) {
    return { error: "Service not found." };
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      category: parsed.data.category || null,
      deliveryDays: parsed.data.deliveryDays,
      deliverables: parsed.data.deliverables || null,
      status: parsed.data.status,
    },
  });

  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/catalog");
  return { success: "Service updated." };
}

export async function deleteServiceAction(serviceId: string): Promise<ActionState> {
  const session = await requireRole("SELLER");
  const existing = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!existing || existing.sellerId !== session.user.id) {
    return { error: "Service not found." };
  }
  await prisma.service.delete({ where: { id: serviceId } });
  revalidatePath("/dashboard/services");
  return { success: "Service deleted." };
}

export async function recordProfileView(sellerId: string) {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (session?.user?.id === sellerId) return;

  await prisma.$transaction([
    prisma.profileView.create({
      data: {
        sellerId,
        viewerId: session?.user?.id ?? null,
      },
    }),
    prisma.user.update({
      where: { id: sellerId },
      data: { profileViews: { increment: 1 } },
    }),
  ]);
}
