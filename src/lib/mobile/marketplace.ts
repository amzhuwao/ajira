import {
  DisputeStatus,
  EscrowStatus,
  MilestoneStatus,
  ProjectStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { transitionEscrow } from "@/lib/escrow";
import { creditEarnings } from "@/lib/wallet";
import { formatMoney } from "@/lib/utils";
import {
  disputeMessageSchema,
  disputeSchema,
  reviewReplySchema,
  reviewSchema,
} from "@/lib/validations";
import { MobileAuthError, requireMobileAuth } from "@/lib/mobile/auth";
import {
  handleMobileError,
  jsonCreated,
  jsonOk,
  money,
  readJsonBody,
} from "@/lib/mobile/http";

type MilestoneInput = { title: string; amount: number; description?: string };

function serializeSellerCard(s: {
  id: string;
  name: string;
  tagline: string | null;
  skills: string | null;
  availability: string;
  kycVerified: boolean;
  profileImageUrl: string | null;
  statistics: {
    averageRating: { toString(): string } | number;
    reviewCount: number;
    completedJobs: number;
  } | null;
  _count?: { services: number };
}) {
  return {
    id: s.id,
    name: s.name,
    tagline: s.tagline,
    skills: s.skills,
    availability: s.availability,
    kycVerified: s.kycVerified,
    profileImageUrl: s.profileImageUrl,
    averageRating: money(s.statistics?.averageRating),
    reviewCount: s.statistics?.reviewCount ?? 0,
    completedJobs: s.statistics?.completedJobs ?? 0,
    serviceCount: s._count?.services ?? 0,
  };
}

function serializeService(svc: {
  id: string;
  title: string;
  description: string;
  price: { toString(): string } | number;
  category: string | null;
  deliveryDays: number;
  deliverables: string | null;
  status: string;
  sellerId: string;
  seller?: { id: string; name: string; profileImageUrl: string | null } | null;
}) {
  return {
    id: svc.id,
    title: svc.title,
    description: svc.description,
    price: money(svc.price),
    category: svc.category,
    deliveryDays: svc.deliveryDays,
    deliverables: svc.deliverables,
    status: svc.status,
    sellerId: svc.sellerId,
    seller: svc.seller
      ? {
          id: svc.seller.id,
          name: svc.seller.name,
          profileImageUrl: svc.seller.profileImageUrl,
        }
      : undefined,
  };
}

export async function mobileListTalent(request: Request) {
  try {
    await requireMobileAuth(request);
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const skill = url.searchParams.get("skill")?.trim();

    const sellers = await prisma.user.findMany({
      where: {
        role: "SELLER",
        status: "ACTIVE",
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { tagline: { contains: q, mode: "insensitive" } },
                { skills: { contains: q, mode: "insensitive" } },
                { bio: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(skill
          ? { skills: { contains: skill, mode: "insensitive" } }
          : {}),
      },
      orderBy: [{ statistics: { averageRating: "desc" } }, { name: "asc" }],
      take: 50,
      include: {
        statistics: true,
        _count: { select: { services: { where: { status: "ACTIVE" } } } },
      },
    });

    return jsonOk({ sellers: sellers.map(serializeSellerCard) });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileGetSeller(request: Request, sellerId: string) {
  try {
    const user = await requireMobileAuth(request);
    const seller = await prisma.user.findFirst({
      where: { id: sellerId, role: "SELLER" },
      include: {
        statistics: true,
        services: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
        },
        reviewsReceived: {
          include: {
            reviewer: { select: { id: true, name: true } },
            project: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!seller) throw new MobileAuthError(404, "Seller not found");

    const favorite =
      user.role === "BUYER" || user.role === "ADMIN"
        ? await prisma.favoriteSeller.findUnique({
            where: {
              buyerId_sellerId: { buyerId: user.id, sellerId: seller.id },
            },
          })
        : null;

    return jsonOk({
      seller: {
        ...serializeSellerCard(seller),
        bio: seller.bio,
        coverImageUrl: seller.coverImageUrl,
        profileViews: seller.profileViews,
        isFavorite: Boolean(favorite),
      },
      services: seller.services.map(serializeService),
      reviews: seller.reviewsReceived.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        replyText: r.replyText,
        createdAt: r.createdAt.toISOString(),
        reviewer: r.reviewer,
        project: r.project,
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileListCatalog(request: Request) {
  try {
    await requireMobileAuth(request);
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const category = url.searchParams.get("category")?.trim();

    const services = await prisma.service.findMany({
      where: {
        status: "ACTIVE",
        seller: { status: "ACTIVE", role: "SELLER" },
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        seller: {
          select: { id: true, name: true, profileImageUrl: true },
        },
      },
    });

    return jsonOk({ services: services.map(serializeService) });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileListFavorites(request: Request) {
  try {
    const user = await requireMobileAuth(request, ["BUYER", "ADMIN"]);
    const favorites = await prisma.favoriteSeller.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        seller: {
          include: {
            statistics: true,
            _count: { select: { services: { where: { status: "ACTIVE" } } } },
          },
        },
      },
    });
    return jsonOk({
      favorites: favorites.map((f) => ({
        id: f.id,
        createdAt: f.createdAt.toISOString(),
        seller: serializeSellerCard(f.seller),
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileToggleFavorite(request: Request, sellerId: string) {
  try {
    const user = await requireMobileAuth(request, ["BUYER", "ADMIN"]);
    if (sellerId === user.id) {
      throw new MobileAuthError(400, "You cannot favorite yourself.");
    }
    const seller = await prisma.user.findFirst({
      where: { id: sellerId, role: "SELLER" },
    });
    if (!seller) throw new MobileAuthError(404, "Seller not found.");

    const existing = await prisma.favoriteSeller.findUnique({
      where: {
        buyerId_sellerId: { buyerId: user.id, sellerId },
      },
    });

    if (existing) {
      await prisma.favoriteSeller.delete({ where: { id: existing.id } });
      return jsonOk({ favorited: false, message: "Removed from favorites." });
    }

    await prisma.favoriteSeller.create({
      data: { buyerId: user.id, sellerId },
    });
    return jsonOk({ favorited: true, message: "Saved to favorites." });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileListDisputes(request: Request) {
  try {
    const user = await requireMobileAuth(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const where =
      user.role === "ADMIN"
        ? {
            ...(status
              ? { status: status as DisputeStatus }
              : { status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] } }),
          }
        : {
            OR: [
              { openedById: user.id },
              { escrow: { buyerId: user.id } },
              { escrow: { sellerId: user.id } },
            ],
            ...(status ? { status: status as DisputeStatus } : {}),
          };

    const disputes = await prisma.dispute.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: {
        escrow: {
          include: {
            project: { select: { id: true, title: true } },
            buyer: { select: { id: true, name: true } },
            seller: { select: { id: true, name: true } },
          },
        },
        openedBy: { select: { id: true, name: true } },
      },
    });

    return jsonOk({
      disputes: disputes.map((d) => ({
        id: d.id,
        status: d.status,
        reason: d.reason,
        resolution: d.resolution,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        openedBy: d.openedBy,
        escrow: {
          id: d.escrow.id,
          amount: money(d.escrow.amount),
          status: d.escrow.status,
          project: d.escrow.project,
          buyer: d.escrow.buyer,
          seller: d.escrow.seller,
        },
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileGetDispute(request: Request, disputeId: string) {
  try {
    const user = await requireMobileAuth(request);
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        escrow: {
          include: {
            project: { select: { id: true, title: true } },
            buyer: { select: { id: true, name: true } },
            seller: { select: { id: true, name: true } },
          },
        },
        openedBy: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, role: true } } },
        },
        evidence: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            fileName: true,
            filePath: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
    });
    if (!dispute) throw new MobileAuthError(404, "Dispute not found");

    const isParty =
      dispute.escrow.buyerId === user.id ||
      dispute.escrow.sellerId === user.id ||
      dispute.openedById === user.id ||
      user.role === "ADMIN";
    if (!isParty) throw new MobileAuthError(403, "Not authorized");

    return jsonOk({
      dispute: {
        id: dispute.id,
        status: dispute.status,
        reason: dispute.reason,
        resolution: dispute.resolution,
        buyerShareAmount: money(dispute.buyerShareAmount),
        sellerShareAmount: money(dispute.sellerShareAmount),
        resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
        createdAt: dispute.createdAt.toISOString(),
        openedBy: dispute.openedBy,
        escrow: {
          id: dispute.escrow.id,
          amount: money(dispute.escrow.amount),
          status: dispute.escrow.status,
          project: dispute.escrow.project,
          buyer: dispute.escrow.buyer,
          seller: dispute.escrow.seller,
        },
        messages: dispute.messages.map((m) => ({
          id: m.id,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
          author: m.author,
        })),
        evidence: dispute.evidence.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileOpenDispute(request: Request) {
  try {
    const user = await requireMobileAuth(request);
    const body = await readJsonBody<{ escrowId?: string; reason?: string }>(request);
    const parsed = disputeSchema.safeParse(body);
    if (!parsed.success) {
      throw new MobileAuthError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid dispute",
      );
    }

    const escrow = await prisma.escrow.findUnique({
      where: { id: parsed.data.escrowId },
      include: { project: true, dispute: true },
    });
    if (!escrow) throw new MobileAuthError(404, "Escrow not found.");
    if (escrow.dispute) throw new MobileAuthError(400, "Dispute already open.");

    const isParty =
      escrow.buyerId === user.id ||
      escrow.sellerId === user.id ||
      user.role === "ADMIN";
    if (!isParty) throw new MobileAuthError(403, "Not authorized.");

    const disputable: EscrowStatus[] = [
      EscrowStatus.FUNDED,
      EscrowStatus.RELEASE_REQUESTED,
      EscrowStatus.REFUND_REQUESTED,
    ];
    if (!disputable.includes(escrow.status)) {
      throw new MobileAuthError(
        400,
        "Disputes can only be opened on active funded escrows.",
      );
    }

    const dispute = await prisma.$transaction(async (tx) => {
      await transitionEscrow(escrow.id, EscrowStatus.DISPUTED, {
        triggeredBy: "user",
        userId: user.id,
        reason: parsed.data.reason,
        tx,
      });
      return tx.dispute.create({
        data: {
          escrowId: escrow.id,
          openedById: user.id,
          reason: parsed.data.reason,
          status: DisputeStatus.OPEN,
          messages: {
            create: { authorId: user.id, body: parsed.data.reason },
          },
        },
      });
    });

    return jsonCreated({ id: dispute.id, status: dispute.status });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAddDisputeMessage(
  request: Request,
  disputeId: string,
) {
  try {
    const user = await requireMobileAuth(request);
    const body = await readJsonBody<{ body?: string }>(request);
    const parsed = disputeMessageSchema.safeParse({
      disputeId,
      body: body.body,
    });
    if (!parsed.success) {
      throw new MobileAuthError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid message",
      );
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { escrow: true },
    });
    if (!dispute) throw new MobileAuthError(404, "Dispute not found.");

    const isParty =
      dispute.escrow.buyerId === user.id ||
      dispute.escrow.sellerId === user.id ||
      user.role === "ADMIN";
    if (!isParty) throw new MobileAuthError(403, "Not authorized.");

    const message = await prisma.disputeMessage.create({
      data: {
        disputeId,
        authorId: user.id,
        body: parsed.data.body,
      },
    });

    if (dispute.status === DisputeStatus.OPEN && user.role === "ADMIN") {
      await prisma.dispute.update({
        where: { id: disputeId },
        data: { status: DisputeStatus.UNDER_REVIEW },
      });
    }

    return jsonCreated({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileSubmitReview(request: Request) {
  try {
    const user = await requireMobileAuth(request, ["BUYER", "ADMIN"]);
    const body = await readJsonBody<{
      projectId?: string;
      rating?: number;
      comment?: string;
    }>(request);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      throw new MobileAuthError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid review",
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      include: { escrow: true, acceptedBid: true },
    });
    if (!project || project.buyerId !== user.id) {
      throw new MobileAuthError(403, "Only the buyer can review this project.");
    }
    if (
      project.status !== ProjectStatus.COMPLETED &&
      project.escrow?.status !== "RELEASED"
    ) {
      throw new MobileAuthError(
        400,
        "Reviews are available after the project is completed.",
      );
    }

    const sellerId = project.acceptedBid?.sellerId ?? project.escrow?.sellerId;
    if (!sellerId) throw new MobileAuthError(400, "No seller found for this project.");

    try {
      const review = await prisma.review.create({
        data: {
          projectId: project.id,
          reviewerId: user.id,
          revieweeId: sellerId,
          rating: parsed.data.rating,
          comment: parsed.data.comment || null,
        },
      });
      try {
        const { refreshSellerStatistics } = await import("@/lib/stats");
        await refreshSellerStatistics(sellerId);
        await createNotification({
          userId: sellerId,
          type: "REVIEW",
          title: `New ${parsed.data.rating}★ review`,
          body: project.title,
          href: `/dashboard/sellers/${sellerId}`,
        });
      } catch (err) {
        console.error("Review side-effects failed", err);
      }
      return jsonCreated({ id: review.id });
    } catch {
      throw new MobileAuthError(400, "You already reviewed this project.");
    }
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileReplyReview(request: Request, reviewId: string) {
  try {
    const user = await requireMobileAuth(request, ["SELLER", "ADMIN"]);
    const body = await readJsonBody<{ replyText?: string }>(request);
    const parsed = reviewReplySchema.safeParse({
      reviewId,
      replyText: body.replyText,
    });
    if (!parsed.success) {
      throw new MobileAuthError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid reply",
      );
    }

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.revieweeId !== user.id) {
      throw new MobileAuthError(404, "Review not found.");
    }
    if (review.replyText) {
      throw new MobileAuthError(400, "You already replied to this review.");
    }

    await prisma.review.update({
      where: { id: reviewId },
      data: {
        replyText: parsed.data.replyText,
        repliedAt: new Date(),
      },
    });
    return jsonOk({ message: "Reply posted." });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileListMilestones(request: Request, escrowId: string) {
  try {
    const user = await requireMobileAuth(request);
    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: {
        milestones: { orderBy: { orderIndex: "asc" } },
        project: { select: { title: true } },
      },
    });
    if (!escrow) throw new MobileAuthError(404, "Escrow not found");
    if (
      escrow.buyerId !== user.id &&
      escrow.sellerId !== user.id &&
      user.role !== "ADMIN"
    ) {
      throw new MobileAuthError(403, "Not authorized");
    }

    return jsonOk({
      escrowId,
      amount: money(escrow.amount),
      status: escrow.status,
      projectTitle: escrow.project.title,
      milestones: escrow.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        amount: money(m.amount),
        orderIndex: m.orderIndex,
        status: m.status,
        fundedAt: m.fundedAt?.toISOString() ?? null,
        deliveredAt: m.deliveredAt?.toISOString() ?? null,
        releasedAt: m.releasedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileSetMilestones(request: Request, escrowId: string) {
  try {
    const user = await requireMobileAuth(request, ["BUYER", "ADMIN"]);
    const body = await readJsonBody<{ milestones?: MilestoneInput[] }>(request);
    const milestones = body.milestones;
    if (!Array.isArray(milestones) || milestones.length === 0) {
      throw new MobileAuthError(
        400,
        "Provide at least one milestone with title and amount.",
      );
    }
    for (const m of milestones) {
      if (!m.title?.trim() || !Number.isFinite(m.amount) || m.amount <= 0) {
        throw new MobileAuthError(400, "Invalid milestone entry.");
      }
    }

    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { milestones: true, project: true },
    });
    if (!escrow || (escrow.buyerId !== user.id && user.role !== "ADMIN")) {
      throw new MobileAuthError(404, "Escrow not found.");
    }
    if (
      escrow.status !== EscrowStatus.PENDING &&
      escrow.status !== EscrowStatus.FUNDED
    ) {
      throw new MobileAuthError(400, "Milestones can only be set before release.");
    }
    if (escrow.milestones.some((m) => m.status === MilestoneStatus.RELEASED)) {
      throw new MobileAuthError(400, "Cannot rewrite milestones after a release.");
    }

    const total = milestones.reduce((sum, m) => sum + m.amount, 0);
    if (Math.abs(total - Number(escrow.amount)) > 0.01) {
      throw new MobileAuthError(
        400,
        `Milestone amounts must total ${formatMoney(escrow.amount)} (got ${formatMoney(total)}).`,
      );
    }

    const funded = escrow.status === EscrowStatus.FUNDED;
    await prisma.$transaction(async (tx) => {
      await tx.milestone.deleteMany({ where: { escrowId: escrow.id } });
      await tx.milestone.createMany({
        data: milestones.map((m, index) => ({
          escrowId: escrow.id,
          title: m.title.trim(),
          description: m.description?.trim() || null,
          amount: m.amount,
          orderIndex: index,
          status: funded ? MilestoneStatus.FUNDED : MilestoneStatus.PENDING,
          fundedAt: funded ? new Date() : null,
        })),
      });
    });

    await createNotification({
      userId: escrow.sellerId,
      type: "MILESTONE",
      title: `Milestones set for ${escrow.project.title}`,
      body: `${milestones.length} milestone(s) totaling ${formatMoney(escrow.amount)}.`,
      href: `/dashboard/escrow/${escrow.id}`,
    });

    return jsonOk({ message: "Milestones saved." });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileMarkMilestoneDelivered(
  request: Request,
  milestoneId: string,
) {
  try {
    const user = await requireMobileAuth(request, ["SELLER", "ADMIN"]);
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { escrow: { include: { project: true } } },
    });
    if (!milestone) throw new MobileAuthError(404, "Milestone not found.");
    if (milestone.escrow.sellerId !== user.id && user.role !== "ADMIN") {
      throw new MobileAuthError(403, "Not authorized.");
    }
    if (
      milestone.status !== MilestoneStatus.FUNDED &&
      milestone.status !== MilestoneStatus.PENDING
    ) {
      throw new MobileAuthError(400, "Milestone cannot be marked delivered.");
    }

    await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: MilestoneStatus.DELIVERED,
        deliveredAt: new Date(),
      },
    });

    await createNotification({
      userId: milestone.escrow.buyerId,
      type: "MILESTONE",
      title: `Milestone delivered: ${milestone.title}`,
      body: milestone.escrow.project.title,
      href: `/dashboard/escrow/${milestone.escrowId}`,
    });

    return jsonOk({ message: "Milestone marked delivered." });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileApproveMilestone(
  request: Request,
  milestoneId: string,
) {
  try {
    const user = await requireMobileAuth(request, ["BUYER", "ADMIN"]);
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        escrow: {
          include: {
            project: true,
            milestones: { orderBy: { orderIndex: "asc" } },
          },
        },
      },
    });
    if (!milestone) throw new MobileAuthError(404, "Milestone not found.");
    if (milestone.escrow.buyerId !== user.id && user.role !== "ADMIN") {
      throw new MobileAuthError(403, "Not authorized.");
    }
    if (milestone.status !== MilestoneStatus.DELIVERED) {
      throw new MobileAuthError(400, "Only delivered milestones can be approved.");
    }
    if (milestone.escrow.status !== EscrowStatus.FUNDED) {
      throw new MobileAuthError(400, "Escrow must be funded.");
    }

    const remaining = milestone.escrow.milestones.filter(
      (m) => m.id !== milestoneId && m.status !== MilestoneStatus.RELEASED,
    );
    const isLast = remaining.length === 0;

    await prisma.$transaction(async (tx) => {
      await creditEarnings({
        userId: milestone.escrow.sellerId,
        amount: milestone.amount,
        escrowId: milestone.escrowId,
        description: `Milestone: ${milestone.title}`,
        applyCommission: true,
        tx,
      });

      await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          status: MilestoneStatus.RELEASED,
          releasedAt: new Date(),
        },
      });

      await tx.escrow.update({
        where: { id: milestone.escrowId },
        data: { releasedAmount: { increment: milestone.amount } },
      });

      if (isLast) {
        await transitionEscrow(milestone.escrowId, EscrowStatus.RELEASE_REQUESTED, {
          triggeredBy: "buyer",
          userId: user.id,
          reason: "Final milestone approved",
          tx,
        });
        await transitionEscrow(milestone.escrowId, EscrowStatus.RELEASED, {
          triggeredBy: "system",
          userId: user.id,
          reason: "All milestones released",
          tx,
        });
        await tx.project.update({
          where: { id: milestone.escrow.projectId },
          data: {
            status: ProjectStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      } else {
        await tx.project.update({
          where: { id: milestone.escrow.projectId },
          data: { status: ProjectStatus.IN_PROGRESS, deliveredAt: null },
        });
      }
    });

    await createNotification({
      userId: milestone.escrow.sellerId,
      type: "ESCROW_RELEASED",
      title: isLast
        ? "Project completed — funds released"
        : `Milestone approved: ${milestone.title}`,
      body: `${formatMoney(milestone.amount)} credited.`,
      href: `/dashboard/wallet`,
    });

    return jsonOk({ message: "Milestone approved and paid." });
  } catch (err) {
    return handleMobileError(err);
  }
}
