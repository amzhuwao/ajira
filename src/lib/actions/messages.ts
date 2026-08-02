"use server";

import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { ensureProjectConversation } from "@/lib/messaging";
import { createNotification } from "@/lib/notifications";
import { requireSession } from "@/lib/utils";
import { messageSchema } from "@/lib/validations";
import type { ActionState } from "./auth";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function sendProjectMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const parsed = messageSchema.safeParse({
    projectId: formData.get("projectId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message" };
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    include: {
      bids: { where: { status: "ACCEPTED" }, take: 1 },
      escrow: true,
      invites: { where: { sellerId: session.user.id }, take: 1 },
    },
  });

  if (!project) return { error: "Project not found." };

  const isBuyer = project.buyerId === session.user.id;
  const isAcceptedSeller = project.bids.some((b) => b.sellerId === session.user.id);
  const isBidder = await prisma.bid.findFirst({
    where: { projectId: project.id, sellerId: session.user.id },
  });
  const isInvited = project.invites.length > 0;
  const isAdmin = session.user.role === "ADMIN";

  if (!isBuyer && !isAcceptedSeller && !isBidder && !isInvited && !isAdmin) {
    return { error: "Not authorized to message on this project." };
  }

  const counterpartIds = new Set<string>([project.buyerId]);
  if (project.escrow?.sellerId) counterpartIds.add(project.escrow.sellerId);
  for (const bid of project.bids) counterpartIds.add(bid.sellerId);
  if (isBidder) counterpartIds.add(session.user.id);
  if (isInvited) counterpartIds.add(session.user.id);

  const file = formData.get("attachment");
  let attachmentUrl: string | null = null;
  let attachmentName: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return { error: "Attachment must be 5MB or smaller." };
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return { error: "Attachment must be JPEG, PNG, WebP, or PDF." };
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const dir = path.join(process.cwd(), "public", "uploads", "messages");
    await mkdir(dir, { recursive: true });
    const filename = `${Date.now()}-${safeName}`;
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
    attachmentUrl = `/uploads/messages/${filename}`;
    attachmentName = file.name.slice(0, 120);
  }

  const conversation = await ensureProjectConversation({
    projectId: project.id,
    participantIds: [...counterpartIds],
  });

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      authorId: session.user.id,
      body: parsed.data.body,
      attachmentUrl,
      attachmentName,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  const recipients = [...counterpartIds].filter((id) => id !== session.user.id);
  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: "MESSAGE",
        title: `New message on ${project.title}`,
        body: parsed.data.body.slice(0, 140),
        href: `/dashboard/messages/${project.id}`,
      }),
    ),
  );

  revalidatePath(`/dashboard/messages`);
  revalidatePath(`/dashboard/messages/${project.id}`);
  revalidatePath(`/dashboard/projects/${project.id}`);
  return { success: "Message sent." };
}

export async function markConversationReadAction(projectId: string): Promise<void> {
  const session = await requireSession();
  const conversation = await prisma.conversation.findUnique({
    where: { projectId },
  });
  if (!conversation) return;

  await prisma.conversationParticipant.updateMany({
    where: { conversationId: conversation.id, userId: session.user.id },
    data: { lastReadAt: new Date() },
  });
}
