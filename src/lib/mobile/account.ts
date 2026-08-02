import { prisma } from "@/lib/prisma";
import { withdrawalSchema } from "@/lib/validations";
import { debitForWithdrawal, getOrCreateWallet } from "@/lib/wallet";
import { MobileAuthError, requireMobileAuth } from "@/lib/mobile/auth";
import {
  handleMobileError,
  jsonCreated,
  jsonOk,
  money,
  readJsonBody,
} from "@/lib/mobile/http";

export async function mobileListNotifications(request: Request) {
  try {
    const user = await requireMobileAuth(request);
    const items = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return jsonOk({
      notifications: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        href: n.href,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount: items.filter((n) => !n.readAt).length,
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileMarkNotificationsRead(request: Request) {
  try {
    const user = await requireMobileAuth(request);
    const body = await readJsonBody<{ ids?: string[]; all?: boolean }>(request);
    if (body.all) {
      await prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
    } else if (body.ids?.length) {
      await prisma.notification.updateMany({
        where: { userId: user.id, id: { in: body.ids } },
        data: { readAt: new Date() },
      });
    }
    return jsonOk({ message: "Updated" });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileGetWallet(request: Request) {
  try {
    const user = await requireMobileAuth(request, ["SELLER", "ADMIN"]);
    const wallet = await getOrCreateWallet(user.id);
    const txns = await prisma.walletTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return jsonOk({
      wallet: {
        balance: money(wallet.balance),
        pendingBalance: money(wallet.pendingBalance),
        currency: "USD",
      },
      transactions: txns.map((t) => ({
        id: t.id,
        type: t.type,
        amount: money(t.amount),
        balanceAfter: money(t.balanceAfter),
        description: t.description,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      })),
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: money(w.amount),
        method: w.method,
        destination: w.destination,
        status: w.status,
        createdAt: w.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileRequestWithdrawal(request: Request) {
  try {
    const user = await requireMobileAuth(request, ["SELLER"]);
    const body = await readJsonBody(request);
    const parsed = withdrawalSchema.safeParse(body);
    if (!parsed.success) {
      throw new MobileAuthError(400, parsed.error.issues[0]?.message ?? "Invalid withdrawal");
    }

    await prisma.$transaction(async (tx) => {
      await debitForWithdrawal({
        userId: user.id,
        amount: parsed.data.amount,
        description: `Withdrawal via ${parsed.data.method}`,
        tx,
      });
      await tx.withdrawalRequest.create({
        data: {
          userId: user.id,
          amount: parsed.data.amount,
          method: parsed.data.method,
          destination: parsed.data.destination,
          status: "PENDING",
        },
      });
    });

    return jsonCreated({ message: "Withdrawal requested" });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileListConversations(request: Request) {
  try {
    const user = await requireMobileAuth(request);
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId: user.id } },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: {
        project: { select: { id: true, title: true } },
        participants: {
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return jsonOk({
      conversations: conversations.map((c) => ({
        id: c.id,
        projectId: c.projectId,
        projectTitle: c.project.title,
        participants: c.participants.map((p) => p.user),
        lastMessage: c.messages[0]
          ? {
              body: c.messages[0].body,
              createdAt: c.messages[0].createdAt.toISOString(),
            }
          : null,
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileGetMessages(request: Request, projectId: string) {
  try {
    const user = await requireMobileAuth(request);
    const conversation = await prisma.conversation.findUnique({
      where: { projectId },
      include: {
        participants: true,
        project: { select: { id: true, title: true, buyerId: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200,
          include: { author: { select: { id: true, name: true } } },
        },
      },
    });

    if (!conversation) {
      // allow empty thread if user is party on project
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { acceptedBid: true },
      });
      if (!project) throw new MobileAuthError(404, "Project not found");
      const allowed =
        user.role === "ADMIN" ||
        project.buyerId === user.id ||
        project.acceptedBid?.sellerId === user.id;
      if (!allowed) throw new MobileAuthError(403, "Not allowed");
      return jsonOk({
        projectId,
        projectTitle: project.title,
        messages: [],
      });
    }

    const allowed =
      user.role === "ADMIN" ||
      conversation.participants.some((p) => p.userId === user.id);
    if (!allowed) throw new MobileAuthError(403, "Not allowed");

    return jsonOk({
      conversationId: conversation.id,
      projectId,
      projectTitle: conversation.project.title,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        body: m.body,
        fileName: m.attachmentName,
        filePath: m.attachmentUrl,
        sender: m.author,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileSendMessage(request: Request, projectId: string) {
  try {
    const user = await requireMobileAuth(request);
    const body = await readJsonBody<{ body?: string }>(request);
    const text = body.body?.trim() ?? "";
    if (!text) throw new MobileAuthError(400, "Message body required");

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { acceptedBid: true },
    });
    if (!project) throw new MobileAuthError(404, "Project not found");

    const sellerId = project.acceptedBid?.sellerId;
    const allowed =
      user.role === "ADMIN" ||
      project.buyerId === user.id ||
      sellerId === user.id;
    if (!allowed) throw new MobileAuthError(403, "Not allowed");

    const participantIds = Array.from(
      new Set([project.buyerId, sellerId].filter(Boolean) as string[]),
    );

    const conversation = await prisma.conversation.upsert({
      where: { projectId },
      create: {
        projectId,
        participants: {
          create: participantIds.map((userId) => ({ userId })),
        },
      },
      update: { updatedAt: new Date() },
    });

    // Ensure current user is a participant
    await prisma.conversationParticipant.upsert({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: user.id,
        },
      },
      create: { conversationId: conversation.id, userId: user.id },
      update: {},
    });

    const message = await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        authorId: user.id,
        body: text.slice(0, 5000),
      },
      include: { author: { select: { id: true, name: true } } },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return jsonCreated({
      message: {
        id: message.id,
        body: message.body,
        sender: message.author,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return handleMobileError(err);
  }
}
