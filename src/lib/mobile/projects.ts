import { EscrowStatus, PaymentChannel, PaymentStatus, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bidSchema, projectSchema, fundEscrowSchema } from "@/lib/validations";
import {
  initiateMobilePayment,
  initiateWebPayment,
  isPaynowConfigured,
  pollPayment,
} from "@/lib/paynow";
import { transitionEscrow } from "@/lib/escrow";
import { creditEarnings } from "@/lib/wallet";
import { MobileAuthError, requireMobileAuth } from "@/lib/mobile/auth";
import {
  handleMobileError,
  jsonCreated,
  jsonOk,
  money,
  readJsonBody,
} from "@/lib/mobile/http";
import { serializeProjectCard } from "@/lib/mobile/dashboard";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://ajira.online"
  );
}

export async function mobileListProjects(request: Request) {
  try {
    const user = await requireMobileAuth(request);
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") ?? "mine";
    const status = url.searchParams.get("status");

    if (scope === "browse" || (user.role === "SELLER" && scope === "open")) {
      const projects = await prisma.project.findMany({
        where: {
          status: "OPEN",
          ...(url.searchParams.get("q")
            ? {
                OR: [
                  {
                    title: {
                      contains: url.searchParams.get("q")!,
                      mode: "insensitive",
                    },
                  },
                  {
                    description: {
                      contains: url.searchParams.get("q")!,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
          ...(url.searchParams.get("category")
            ? { category: url.searchParams.get("category")! }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          _count: { select: { bids: true } },
          buyer: { select: { id: true, name: true } },
        },
      });
      return jsonOk({
        projects: projects.map((p) => ({
          ...serializeProjectCard(p),
          buyer: p.buyer,
        })),
      });
    }

    const where =
      user.role === "ADMIN"
        ? {
            ...(status ? { status: status as ProjectStatus } : {}),
          }
        : user.role === "BUYER"
          ? {
              buyerId: user.id,
              ...(status ? { status: status as ProjectStatus } : {}),
            }
          : {
              OR: [
                { acceptedBid: { sellerId: user.id } },
                { bids: { some: { sellerId: user.id } } },
              ],
            };

    const projects = await prisma.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        _count: { select: { bids: true } },
        escrow: { select: { id: true, status: true, amount: true } },
      },
    });

    return jsonOk({ projects: projects.map(serializeProjectCard) });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileCreateProject(request: Request) {
  try {
    const user = await requireMobileAuth(request, ["BUYER", "ADMIN"]);
    const body = await readJsonBody(request);
    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      throw new MobileAuthError(400, parsed.error.issues[0]?.message ?? "Invalid project");
    }

    const questions = parsed.data.screeningQuestions
      ? parsed.data.screeningQuestions
          .split("\n")
          .map((q) => q.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];

    const project = await prisma.project.create({
      data: {
        buyerId: user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        budgetMin: parsed.data.budgetMin,
        budgetMax: parsed.data.budgetMax,
        category: parsed.data.category || null,
        timeline: parsed.data.timeline,
        screeningQuestions: questions,
        status: "OPEN",
      },
      include: { _count: { select: { bids: true } } },
    });

    return jsonCreated({ project: serializeProjectCard(project) });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileGetProject(request: Request, projectId: string) {
  try {
    const user = await requireMobileAuth(request);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        acceptedBid: {
          include: { seller: { select: { id: true, name: true, email: true } } },
        },
        bids: {
          orderBy: { createdAt: "desc" },
          include: {
            seller: {
              select: {
                id: true,
                name: true,
                tagline: true,
                kycVerified: true,
                statistics: true,
              },
            },
          },
        },
        escrow: true,
        _count: { select: { bids: true } },
      },
    });
    if (!project) throw new MobileAuthError(404, "Project not found");

    const isParty =
      user.role === "ADMIN" ||
      project.buyerId === user.id ||
      project.acceptedBid?.sellerId === user.id ||
      project.bids.some((b) => b.sellerId === user.id) ||
      project.status === "OPEN";

    if (!isParty) throw new MobileAuthError(403, "Not allowed to view this project");

    return jsonOk({
      project: {
        ...serializeProjectCard(project),
        description: project.description,
        screeningQuestions: project.screeningQuestions,
        buyer: project.buyer,
        acceptedBid: project.acceptedBid
          ? {
              id: project.acceptedBid.id,
              amount: money(project.acceptedBid.amount),
              seller: project.acceptedBid.seller,
            }
          : null,
        escrow: project.escrow
          ? {
              id: project.escrow.id,
              status: project.escrow.status,
              amount: money(project.escrow.amount),
              feeAmount: money(project.escrow.feeAmount),
              fundedAt: project.escrow.fundedAt?.toISOString() ?? null,
              releasedAt: project.escrow.releasedAt?.toISOString() ?? null,
            }
          : null,
        bids:
          user.role === "ADMIN" || project.buyerId === user.id
            ? project.bids.map((b) => ({
                id: b.id,
                amount: money(b.amount),
                proposal: b.proposal,
                deliveryDays: b.deliveryDays,
                status: b.status,
                portfolioUrl: b.portfolioUrl,
                seller: {
                  id: b.seller.id,
                  name: b.seller.name,
                  tagline: b.seller.tagline,
                  kycVerified: b.seller.kycVerified,
                  rating: money(b.seller.statistics?.averageRating),
                  jobs: b.seller.statistics?.completedJobs ?? 0,
                },
                createdAt: b.createdAt.toISOString(),
              }))
            : project.bids
                .filter((b) => b.sellerId === user.id)
                .map((b) => ({
                  id: b.id,
                  amount: money(b.amount),
                  proposal: b.proposal,
                  deliveryDays: b.deliveryDays,
                  status: b.status,
                  createdAt: b.createdAt.toISOString(),
                })),
      },
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobilePlaceBid(request: Request) {
  try {
    const user = await requireMobileAuth(request, ["SELLER"]);
    const body = await readJsonBody(request);
    const parsed = bidSchema.safeParse(body);
    if (!parsed.success) {
      throw new MobileAuthError(400, parsed.error.issues[0]?.message ?? "Invalid bid");
    }

    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
    });
    if (!project || project.status !== "OPEN") {
      throw new MobileAuthError(400, "Project is not open for bids");
    }

    const existing = await prisma.bid.findFirst({
      where: { projectId: project.id, sellerId: user.id },
    });
    if (existing) {
      throw new MobileAuthError(409, "You already bid on this project");
    }

    const bid = await prisma.bid.create({
      data: {
        projectId: project.id,
        sellerId: user.id,
        amount: parsed.data.amount,
        proposal: parsed.data.proposal,
        deliveryDays: parsed.data.deliveryDays,
        portfolioUrl: parsed.data.portfolioUrl || null,
        screeningAnswers: parsed.data.screeningAnswers
          ? parsed.data.screeningAnswers.split("\n").map((s) => s.trim()).filter(Boolean)
          : [],
        status: "PENDING",
      },
    });

    return jsonCreated({
      bid: {
        id: bid.id,
        amount: money(bid.amount),
        status: bid.status,
      },
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAcceptBid(request: Request, bidId: string) {
  try {
    const user = await requireMobileAuth(request, ["BUYER", "ADMIN"]);
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: { project: true },
    });
    if (!bid || bid.project.buyerId !== user.id) {
      throw new MobileAuthError(404, "Bid not found");
    }
    if (bid.project.status !== "OPEN") {
      throw new MobileAuthError(400, "Project is not open");
    }

    await prisma.$transaction(async (tx) => {
      await tx.bid.update({
        where: { id: bid.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      await tx.bid.updateMany({
        where: { projectId: bid.projectId, id: { not: bid.id }, status: "PENDING" },
        data: { status: "REJECTED", respondedAt: new Date() },
      });
      await tx.project.update({
        where: { id: bid.projectId },
        data: { status: "IN_PROGRESS", acceptedBidId: bid.id },
      });
      await tx.escrow.create({
        data: {
          projectId: bid.projectId,
          bidId: bid.id,
          buyerId: bid.project.buyerId,
          sellerId: bid.sellerId,
          amount: bid.amount,
          status: EscrowStatus.PENDING,
          milestones: {
            create: {
              title: "Full delivery",
              description: "Complete project delivery",
              amount: bid.amount,
              orderIndex: 0,
              status: "PENDING",
            },
          },
        },
      });
    });

    const escrow = await prisma.escrow.findUnique({ where: { projectId: bid.projectId } });
    return jsonOk({
      message: "Bid accepted. Fund escrow to start work.",
      escrowId: escrow?.id ?? null,
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileFundEscrow(request: Request) {
  try {
    const user = await requireMobileAuth(request, ["BUYER", "ADMIN"]);
    if (!isPaynowConfigured()) {
      throw new MobileAuthError(503, "Paynow is not configured on the server");
    }

    const body = await readJsonBody(request);
    const parsed = fundEscrowSchema.safeParse(body);
    if (!parsed.success) {
      throw new MobileAuthError(400, parsed.error.issues[0]?.message ?? "Invalid funding request");
    }

    const escrow = await prisma.escrow.findUnique({
      where: { id: parsed.data.escrowId },
      include: { project: true, buyer: true },
    });
    if (!escrow || (escrow.buyerId !== user.id && user.role !== "ADMIN")) {
      throw new MobileAuthError(404, "Escrow not found");
    }
    if (escrow.status !== EscrowStatus.PENDING) {
      throw new MobileAuthError(400, "Escrow is not awaiting payment");
    }

    const reference = `AJIRA-${escrow.id.slice(-8)}-${Date.now()}`;
    const amount = money(escrow.amount);
    const description = `Escrow: ${escrow.project.title}`;
    // Deep-link friendly return for the native app + web fallback
    const returnUrl = `${appBaseUrl()}/app/paynow-return?escrowId=${escrow.id}`;

    if (parsed.data.channel === "WEB") {
      const result = await initiateWebPayment({
        reference,
        email: escrow.buyer.email,
        description,
        amount,
        returnUrl,
      });
      if (!result.success || !result.redirectUrl) {
        throw new MobileAuthError(502, result.error ?? "Failed to initiate Paynow payment");
      }

      const payment = await prisma.escrowPayment.create({
        data: {
          escrowId: escrow.id,
          merchantReference: reference,
          pollUrl: result.pollUrl,
          redirectUrl: result.redirectUrl,
          channel: PaymentChannel.WEB,
          amount: escrow.amount,
          status: PaymentStatus.SENT,
        },
      });

      return jsonOk({
        channel: "WEB",
        paymentId: payment.id,
        redirectUrl: result.redirectUrl,
        pollUrl: result.pollUrl,
        escrowId: escrow.id,
      });
    }

    const phone = parsed.data.phone!;
    const method = parsed.data.channel === "ECOCASH" ? "ecocash" : "onemoney";
    const result = await initiateMobilePayment({
      reference,
      email: escrow.buyer.email,
      description,
      amount,
      phone,
      method,
    });
    if (!result.success) {
      throw new MobileAuthError(502, result.error ?? "Failed to initiate mobile payment");
    }

    const payment = await prisma.escrowPayment.create({
      data: {
        escrowId: escrow.id,
        merchantReference: reference,
        pollUrl: result.pollUrl,
        channel: parsed.data.channel as PaymentChannel,
        phone,
        amount: escrow.amount,
        status: PaymentStatus.SENT,
        instructions: result.instructions ?? null,
      },
    });

    return jsonOk({
      channel: parsed.data.channel,
      paymentId: payment.id,
      instructions: result.instructions ?? "Confirm the payment prompt on your phone.",
      pollUrl: result.pollUrl,
      escrowId: escrow.id,
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobilePollPayment(request: Request, paymentId: string) {
  try {
    const user = await requireMobileAuth(request, ["BUYER", "ADMIN"]);
    const payment = await prisma.escrowPayment.findUnique({
      where: { id: paymentId },
      include: { escrow: true },
    });
    if (!payment || (payment.escrow.buyerId !== user.id && user.role !== "ADMIN")) {
      throw new MobileAuthError(404, "Payment not found");
    }

    if (payment.status === PaymentStatus.PAID || payment.escrow.status === EscrowStatus.FUNDED) {
      return jsonOk({
        status: "PAID",
        escrowStatus: payment.escrow.status,
      });
    }

    if (!payment.pollUrl) {
      throw new MobileAuthError(400, "No poll URL for this payment");
    }

    const poll = await pollPayment(payment.pollUrl);
    if (poll.paid) {
      await prisma.$transaction(async (tx) => {
        await tx.escrowPayment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PAID,
            paynowReference: poll.paynowReference ?? payment.paynowReference,
            rawStatus: poll.status,
          },
        });
        if (payment.escrow.status === EscrowStatus.PENDING) {
          await transitionEscrow(payment.escrowId, EscrowStatus.FUNDED, {
            triggeredBy: "paynow",
            reason: "Mobile poll confirmed payment",
            tx,
          });
        }
      });
      return jsonOk({ status: "PAID", escrowStatus: "FUNDED" });
    }

    return jsonOk({
      status: payment.status,
      rawStatus: poll.status,
      escrowStatus: payment.escrow.status,
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileGetEscrow(request: Request, escrowId: string) {
  try {
    const user = await requireMobileAuth(request);
    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: {
        project: { select: { id: true, title: true, status: true } },
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 5 },
        milestones: { orderBy: { orderIndex: "asc" } },
        dispute: { select: { id: true, status: true } },
      },
    });
    if (!escrow) throw new MobileAuthError(404, "Escrow not found");
    if (
      user.role !== "ADMIN" &&
      escrow.buyerId !== user.id &&
      escrow.sellerId !== user.id
    ) {
      throw new MobileAuthError(403, "Not allowed");
    }

    return jsonOk({
      escrow: {
        id: escrow.id,
        status: escrow.status,
        amount: money(escrow.amount),
        feeAmount: money(escrow.feeAmount),
        releasedAmount: money(escrow.releasedAmount),
        fundedAt: escrow.fundedAt?.toISOString() ?? null,
        releasedAt: escrow.releasedAt?.toISOString() ?? null,
        project: escrow.project,
        buyer: escrow.buyer,
        seller: escrow.seller,
        dispute: escrow.dispute,
        payments: escrow.payments.map((p) => ({
          id: p.id,
          status: p.status,
          channel: p.channel,
          amount: money(p.amount),
          createdAt: p.createdAt.toISOString(),
        })),
        milestones: escrow.milestones.map((m) => ({
          id: m.id,
          title: m.title,
          amount: money(m.amount),
          status: m.status,
          sortOrder: m.orderIndex,
        })),
      },
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileMarkDelivered(request: Request, projectId: string) {
  try {
    const user = await requireMobileAuth(request, ["SELLER", "ADMIN"]);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { escrow: true, acceptedBid: true },
    });
    if (!project?.escrow || !project.acceptedBid) {
      throw new MobileAuthError(404, "Project/escrow not found");
    }
    if (project.acceptedBid.sellerId !== user.id && user.role !== "ADMIN") {
      throw new MobileAuthError(403, "Not allowed");
    }
    if (!["FUNDED", "RELEASE_REQUESTED"].includes(project.escrow.status)) {
      throw new MobileAuthError(400, "Escrow is not funded");
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { status: "DELIVERED" },
      });
      if (project.escrow!.status === EscrowStatus.FUNDED) {
        await transitionEscrow(project.escrow!.id, EscrowStatus.RELEASE_REQUESTED, {
          triggeredBy: "seller",
          userId: user.id,
          reason: "Work delivered",
          tx,
        });
      }
    });

    return jsonOk({ message: "Marked as delivered. Waiting for buyer approval." });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileApproveWork(request: Request, escrowId: string) {
  try {
    const user = await requireMobileAuth(request, ["BUYER", "ADMIN"]);
    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { project: true, walletTxns: { where: { type: "CREDIT" } } },
    });
    if (!escrow || (escrow.buyerId !== user.id && user.role !== "ADMIN")) {
      throw new MobileAuthError(404, "Escrow not found");
    }
    if (!["FUNDED", "RELEASE_REQUESTED"].includes(escrow.status)) {
      throw new MobileAuthError(400, "Escrow cannot be released from this status");
    }

    await prisma.$transaction(async (tx) => {
      if (escrow.status === EscrowStatus.FUNDED) {
        await transitionEscrow(escrow.id, EscrowStatus.RELEASE_REQUESTED, {
          triggeredBy: "buyer",
          userId: user.id,
          reason: "Buyer approving work",
          tx,
        });
      }
      await transitionEscrow(escrow.id, EscrowStatus.RELEASED, {
        triggeredBy: "buyer",
        userId: user.id,
        reason: "Work approved",
        tx,
      });
      if (escrow.walletTxns.length === 0) {
        await creditEarnings({
          userId: escrow.sellerId,
          amount: escrow.amount,
          escrowId: escrow.id,
          description: `Approved: ${escrow.project.title}`,
          applyCommission: true,
          tx,
        });
      }
    });

    return jsonOk({ message: "Work approved. Funds released to seller." });
  } catch (err) {
    return handleMobileError(err);
  }
}
