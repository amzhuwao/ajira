import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? prisma;
  return client.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      href: params.href ?? null,
    },
  });
}

export async function createNotifications(
  items: Array<{
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    href?: string;
  }>,
  tx?: Prisma.TransactionClient,
) {
  if (items.length === 0) return;
  const client = tx ?? prisma;
  await client.notification.createMany({
    data: items.map((item) => ({
      userId: item.userId,
      type: item.type,
      title: item.title,
      body: item.body,
      href: item.href ?? null,
    })),
  });
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}
