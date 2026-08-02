import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/mobile/auth";
import { handleMobileError, jsonOk, money } from "@/lib/mobile/http";

export async function mobileDashboardSummary(request: Request) {
  try {
    const user = await requireMobileAuth(request);

    if (user.role === "BUYER") {
      const [projects, openDisputes, unread] = await Promise.all([
        prisma.project.findMany({
          where: { buyerId: user.id },
          orderBy: { updatedAt: "desc" },
          take: 40,
          include: {
            _count: { select: { bids: true } },
            escrow: { select: { id: true, status: true, amount: true } },
          },
        }),
        prisma.dispute.count({
          where: {
            status: { in: ["OPEN", "UNDER_REVIEW"] },
            OR: [
              { openedById: user.id },
              { escrow: { buyerId: user.id } },
            ],
          },
        }),
        prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      ]);

      const byStatus: Record<string, number> = {};
      for (const p of projects) {
        byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      }

      return jsonOk({
        role: user.role,
        counts: {
          projects: projects.length,
          openDisputes,
          unreadNotifications: unread,
          byStatus,
        },
        recentProjects: projects.slice(0, 10).map(serializeProjectCard),
      });
    }

    if (user.role === "SELLER") {
      const [openProjects, myBids, wallet, unread] = await Promise.all([
        prisma.project.count({ where: { status: "OPEN" } }),
        prisma.bid.findMany({
          where: { sellerId: user.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            project: { select: { id: true, title: true, status: true } },
          },
        }),
        prisma.sellerWallet.findUnique({ where: { userId: user.id } }),
        prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      ]);

      return jsonOk({
        role: user.role,
        counts: {
          openProjects,
          myBids: myBids.length,
          unreadNotifications: unread,
          walletBalance: money(wallet?.balance),
        },
        recentBids: myBids.map((b) => ({
          id: b.id,
          amount: money(b.amount),
          status: b.status,
          project: b.project,
          createdAt: b.createdAt.toISOString(),
        })),
      });
    }

    // ADMIN
    const [
      userCount,
      projectCount,
      fundedEscrows,
      openDisputes,
      pendingWithdrawals,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.escrow.count({ where: { status: "FUNDED" } }),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    ]);

    return jsonOk({
      role: user.role,
      counts: {
        users: userCount,
        projects: projectCount,
        fundedEscrows,
        openDisputes,
        pendingWithdrawals,
      },
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export function serializeProjectCard(p: {
  id: string;
  title: string;
  status: string;
  budgetMin: { toString(): string } | number;
  budgetMax: { toString(): string } | number;
  category: string | null;
  timeline: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { bids: number };
  escrow?: { id: string; status: string; amount: { toString(): string } | number } | null;
}) {
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    budgetMin: money(p.budgetMin),
    budgetMax: money(p.budgetMax),
    category: p.category,
    timeline: p.timeline,
    bidCount: p._count?.bids ?? 0,
    escrow: p.escrow
      ? {
          id: p.escrow.id,
          status: p.escrow.status,
          amount: money(p.escrow.amount),
        }
      : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
