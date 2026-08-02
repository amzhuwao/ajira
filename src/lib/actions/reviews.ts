"use server";

import { ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/utils";
import { reviewReplySchema, reviewSchema } from "@/lib/validations";
import type { ActionState } from "./auth";

export async function submitReviewAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const parsed = reviewSchema.safeParse({
    projectId: formData.get("projectId"),
    rating: formData.get("rating"),
    comment: formData.get("comment") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid review" };
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    include: {
      escrow: true,
      acceptedBid: true,
    },
  });

  if (!project || project.buyerId !== session.user.id) {
    return { error: "Only the buyer can review this project." };
  }

  if (project.status !== ProjectStatus.COMPLETED && project.escrow?.status !== "RELEASED") {
    return { error: "Reviews are available after the project is completed." };
  }

  const sellerId = project.acceptedBid?.sellerId ?? project.escrow?.sellerId;
  if (!sellerId) return { error: "No seller found for this project." };

  try {
    await prisma.review.create({
      data: {
        projectId: project.id,
        reviewerId: session.user.id,
        revieweeId: sellerId,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      },
    });
  } catch {
    return { error: "You already reviewed this project." };
  }

  try {
    const seller = await prisma.user.findUnique({ where: { id: sellerId } });
    if (seller) {
      const { sendReviewSubmittedEmail } = await import("@/lib/mail");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ajira.online";
      await sendReviewSubmittedEmail({
        to: seller.email,
        name: seller.name,
        rating: parsed.data.rating,
        projectTitle: project.title,
        profileUrl: `${appUrl}/dashboard/sellers/${seller.id}`,
      });
    }
    const { refreshSellerStatistics } = await import("@/lib/stats");
    await refreshSellerStatistics(sellerId);
  } catch (err) {
    console.error("Review side-effects failed", err);
  }

  revalidatePath(`/dashboard/projects/${project.id}`);
  revalidatePath(`/dashboard/sellers/${sellerId}`);
  return { success: "Review submitted." };
}

export async function replyToReviewAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const parsed = reviewReplySchema.safeParse({
    reviewId: formData.get("reviewId"),
    replyText: formData.get("replyText"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid reply" };
  }

  const review = await prisma.review.findUnique({ where: { id: parsed.data.reviewId } });
  if (!review || review.revieweeId !== session.user.id) {
    return { error: "Review not found." };
  }

  if (review.replyText) {
    return { error: "You already replied to this review." };
  }

  await prisma.review.update({
    where: { id: review.id },
    data: {
      replyText: parsed.data.replyText,
      repliedAt: new Date(),
    },
  });

  revalidatePath(`/dashboard/sellers/${session.user.id}`);
  revalidatePath("/dashboard/profile");
  return { success: "Reply posted." };
}
