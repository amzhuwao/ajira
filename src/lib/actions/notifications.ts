"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/utils";
import type { ActionState } from "./auth";

export async function markNotificationReadAction(notificationId: string): Promise<ActionState> {
  const session = await requireSession();
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notification || notification.userId !== session.user.id) {
    return { error: "Notification not found." };
  }
  await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  return { success: "Marked read." };
}

export async function markAllNotificationsReadAction(): Promise<ActionState> {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  return { success: "All notifications marked read." };
}
