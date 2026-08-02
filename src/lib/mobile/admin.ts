import bcrypt from "bcryptjs";
import { EscrowStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { transitionEscrow } from "@/lib/escrow";
import { creditEarnings, getOrCreateWallet } from "@/lib/wallet";
import { logAdminAction } from "@/lib/audit";
import {
  DEFAULT_SETTINGS,
  ensureDefaultSettings,
  getAllSettings,
  setSetting,
} from "@/lib/settings";
import {
  adminUpdateUserSchema,
  platformSettingsSchema,
} from "@/lib/validations";
import { MobileAuthError, publicUser, requireMobileAuth } from "@/lib/mobile/auth";
import {
  handleMobileError,
  jsonOk,
  money,
  readJsonBody,
} from "@/lib/mobile/http";

const FORCE_STATUSES: EscrowStatus[] = [
  EscrowStatus.FUNDED,
  EscrowStatus.RELEASE_REQUESTED,
  EscrowStatus.REFUND_REQUESTED,
];

export async function mobileAdminOverview(request: Request) {
  try {
    await requireMobileAuth(request, ["ADMIN"]);

    const [
      userCount,
      buyerCount,
      sellerCount,
      projectCount,
      openProjects,
      fundedEscrows,
      releasedEscrows,
      openDisputes,
      pendingWithdrawals,
      fundedVolume,
      recentDisputes,
      recentWithdrawals,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "BUYER" } }),
      prisma.user.count({ where: { role: "SELLER" } }),
      prisma.project.count(),
      prisma.project.count({ where: { status: "OPEN" } }),
      prisma.escrow.count({ where: { status: "FUNDED" } }),
      prisma.escrow.count({ where: { status: "RELEASED" } }),
      prisma.dispute.count({
        where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
      }),
      prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
      prisma.escrow.aggregate({
        where: {
          status: { in: ["FUNDED", "RELEASE_REQUESTED", "DISPUTED"] },
        },
        _sum: { amount: true },
      }),
      prisma.dispute.findMany({
        where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
        take: 8,
        orderBy: { updatedAt: "desc" },
        include: {
          escrow: { include: { project: { select: { title: true } } } },
        },
      }),
      prisma.withdrawalRequest.findMany({
        where: { status: { in: ["PENDING", "APPROVED"] } },
        take: 8,
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    return jsonOk({
      counts: {
        users: userCount,
        buyers: buyerCount,
        sellers: sellerCount,
        projects: projectCount,
        openProjects,
        fundedEscrows,
        releasedEscrows,
        openDisputes,
        pendingWithdrawals,
        fundedVolume: money(fundedVolume._sum.amount),
      },
      recentDisputes: recentDisputes.map((d) => ({
        id: d.id,
        status: d.status,
        projectTitle: d.escrow.project.title,
        createdAt: d.createdAt.toISOString(),
      })),
      recentWithdrawals: recentWithdrawals.map((w) => ({
        id: w.id,
        amount: money(w.amount),
        status: w.status,
        method: w.method,
        user: w.user,
        createdAt: w.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminListUsers(request: Request) {
  try {
    await requireMobileAuth(request, ["ADMIN"]);
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const role = url.searchParams.get("role");
    const status = url.searchParams.get("status");

    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role: role as Role } : {}),
        ...(status ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        status: true,
        kycVerified: true,
        createdAt: true,
      },
    });

    return jsonOk({
      users: users.map((u) => ({
        ...publicUser(u),
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminGetUser(request: Request, userId: string) {
  try {
    await requireMobileAuth(request, ["ADMIN"]);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        statistics: true,
        _count: {
          select: {
            projectsAsBuyer: true,
            bids: true,
            services: true,
          },
        },
      },
    });
    if (!user) throw new MobileAuthError(404, "User not found");

    return jsonOk({
      user: {
        ...publicUser(user),
        createdAt: user.createdAt.toISOString(),
        wallet: user.wallet
          ? {
              balance: money(user.wallet.balance),
              pendingBalance: money(user.wallet.pendingBalance),
            }
          : null,
        statistics: user.statistics
          ? {
              completedJobs: user.statistics.completedJobs,
              averageRating: money(user.statistics.averageRating),
              reviewCount: user.statistics.reviewCount,
              totalEarnings: money(user.statistics.totalEarnings),
            }
          : null,
        counts: user._count,
      },
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminUpdateUser(request: Request, userId: string) {
  try {
    const admin = await requireMobileAuth(request, ["ADMIN"]);
    const body = await readJsonBody<Record<string, unknown>>(request);
    const parsed = adminUpdateUserSchema.safeParse({
      userId,
      name: body.name,
      email: body.email,
      role: body.role,
      status: body.status ?? "ACTIVE",
      kycVerified: body.kycVerified === true || body.kycVerified === "true" ? "true" : "false",
      phone: body.phone ?? "",
      password: body.password ?? "",
    });
    if (!parsed.success) {
      throw new MobileAuthError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
      );
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new MobileAuthError(404, "User not found");

    if (target.role === Role.ADMIN && parsed.data.role !== Role.ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        throw new MobileAuthError(400, "Cannot demote the last admin account.");
      }
    }

    const data: Prisma.UserUpdateInput = {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      status: parsed.data.status,
      kycVerified: parsed.data.kycVerified === "true",
      phone: parsed.data.phone || null,
    };
    if (parsed.data.password) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    });

    if (parsed.data.role === "SELLER") {
      await getOrCreateWallet(userId);
    }

    await logAdminAction({
      adminId: admin.id,
      action: "update_user",
      summary: `Updated user ${updated.email}`,
      targetType: "User",
      targetId: userId,
      oldValue: { role: target.role, status: target.status },
      newValue: {
        role: updated.role,
        status: updated.status,
        kycVerified: updated.kycVerified,
      },
    });

    return jsonOk({ user: publicUser(updated), message: "User updated." });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminListEscrows(request: Request) {
  try {
    await requireMobileAuth(request, ["ADMIN"]);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const escrows = await prisma.escrow.findMany({
      where: status ? { status: status as EscrowStatus } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: {
        project: { select: { id: true, title: true } },
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        dispute: { select: { id: true, status: true } },
      },
    });

    return jsonOk({
      escrows: escrows.map((e) => ({
        id: e.id,
        status: e.status,
        amount: money(e.amount),
        feeAmount: money(e.feeAmount),
        fundedAt: e.fundedAt?.toISOString() ?? null,
        releasedAt: e.releasedAt?.toISOString() ?? null,
        updatedAt: e.updatedAt.toISOString(),
        project: e.project,
        buyer: e.buyer,
        seller: e.seller,
        dispute: e.dispute,
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminForceRelease(
  request: Request,
  escrowId: string,
) {
  try {
    const admin = await requireMobileAuth(request, ["ADMIN"]);
    let note = "Admin force release";
    try {
      const body = await readJsonBody<{ note?: string }>(request);
      note = (body.note?.trim() || note).slice(0, 500);
    } catch {
      /* empty body ok */
    }

    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: {
        project: true,
        walletTxns: { where: { type: "CREDIT" } },
      },
    });
    if (!escrow) throw new MobileAuthError(404, "Escrow not found.");
    if (!FORCE_STATUSES.includes(escrow.status)) {
      throw new MobileAuthError(400, `Cannot release from status ${escrow.status}.`);
    }

    await prisma.$transaction(async (tx) => {
      await transitionEscrow(escrowId, EscrowStatus.RELEASED, {
        triggeredBy: "admin",
        userId: admin.id,
        reason: note,
        tx,
      });
      if (escrow.walletTxns.length === 0) {
        await creditEarnings({
          userId: escrow.sellerId,
          amount: escrow.amount,
          escrowId,
          description: `Admin release: ${escrow.project.title}`,
          applyCommission: true,
          tx,
        });
      }
    });

    await logAdminAction({
      adminId: admin.id,
      action: "escrow_force_release",
      summary: `Force-released escrow for ${escrow.project.title}`,
      targetType: "Escrow",
      targetId: escrowId,
      oldValue: { status: escrow.status },
      newValue: { status: "RELEASED", reason: note },
    });

    return jsonOk({ message: "Escrow released to seller wallet." });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminForceRefund(
  request: Request,
  escrowId: string,
) {
  try {
    const admin = await requireMobileAuth(request, ["ADMIN"]);
    let note =
      "Admin refund — complete Paynow refund in merchant dashboard";
    try {
      const body = await readJsonBody<{ note?: string }>(request);
      note = (body.note?.trim() || note).slice(0, 500);
    } catch {
      /* empty body ok */
    }

    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { project: true },
    });
    if (!escrow) throw new MobileAuthError(404, "Escrow not found.");
    if (!FORCE_STATUSES.includes(escrow.status)) {
      throw new MobileAuthError(400, `Cannot refund from status ${escrow.status}.`);
    }

    await transitionEscrow(escrowId, EscrowStatus.REFUNDED, {
      triggeredBy: "admin",
      userId: admin.id,
      reason: note,
    });

    await logAdminAction({
      adminId: admin.id,
      action: "escrow_force_refund",
      summary: `Marked escrow refunded for ${escrow.project.title}`,
      targetType: "Escrow",
      targetId: escrowId,
      oldValue: { status: escrow.status },
      newValue: { status: "REFUNDED", reason: note },
    });

    return jsonOk({
      message:
        "Escrow marked refunded. Process the Paynow refund in the merchant dashboard.",
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminResolveDispute(
  request: Request,
  disputeId: string,
) {
  try {
    const admin = await requireMobileAuth(request, ["ADMIN"]);
    const body = await readJsonBody<{
      resolution?: "RELEASE" | "REFUND";
      note?: string;
    }>(request);

    if (body.resolution !== "RELEASE" && body.resolution !== "REFUND") {
      throw new MobileAuthError(400, "resolution must be RELEASE or REFUND");
    }
    const note = (body.note?.trim() || `Admin ${body.resolution}`).slice(0, 2000);

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { escrow: { include: { project: true } } },
    });
    if (!dispute || dispute.escrow.status !== EscrowStatus.DISPUTED) {
      throw new MobileAuthError(400, "Dispute not open.");
    }

    await prisma.$transaction(async (tx) => {
      if (body.resolution === "RELEASE") {
        await transitionEscrow(dispute.escrowId, EscrowStatus.RELEASED, {
          triggeredBy: "admin",
          userId: admin.id,
          reason: note,
          tx,
        });
        await creditEarnings({
          userId: dispute.escrow.sellerId,
          amount: dispute.escrow.amount,
          escrowId: dispute.escrowId,
          description: `Dispute release: ${dispute.escrow.project.title}`,
          applyCommission: true,
          tx,
        });
        await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: "RESOLVED_RELEASE",
            resolution: note,
            resolvedAt: new Date(),
            sellerShareAmount: dispute.escrow.amount,
            buyerShareAmount: 0,
          },
        });
      } else {
        await transitionEscrow(dispute.escrowId, EscrowStatus.REFUNDED, {
          triggeredBy: "admin",
          userId: admin.id,
          reason: note,
          tx,
        });
        await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: "RESOLVED_REFUND",
            resolution: `${note}\n\nManual Paynow refund required.`,
            resolvedAt: new Date(),
            buyerShareAmount: dispute.escrow.amount,
            sellerShareAmount: 0,
          },
        });
      }
    });

    await logAdminAction({
      adminId: admin.id,
      action: body.resolution === "RELEASE" ? "dispute_release" : "dispute_refund",
      summary: `Resolved dispute ${disputeId} via ${body.resolution}`,
      targetType: "Dispute",
      targetId: disputeId,
      newValue: { resolution: body.resolution, note },
    });

    return jsonOk({ message: `Dispute resolved via ${body.resolution}.` });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminListWithdrawals(request: Request) {
  try {
    await requireMobileAuth(request, ["ADMIN"]);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: status
        ? { status: status as never }
        : { status: { in: ["PENDING", "APPROVED"] } },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return jsonOk({
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: money(w.amount),
        method: w.method,
        destination: w.destination,
        status: w.status,
        adminNote: w.adminNote,
        createdAt: w.createdAt.toISOString(),
        processedAt: w.processedAt?.toISOString() ?? null,
        user: w.user,
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminProcessWithdrawal(
  request: Request,
  withdrawalId: string,
) {
  try {
    const admin = await requireMobileAuth(request, ["ADMIN"]);
    const body = await readJsonBody<{
      decision?: "APPROVED" | "COMPLETED" | "REJECTED";
      adminNote?: string;
    }>(request);

    if (!body.decision || !["APPROVED", "COMPLETED", "REJECTED"].includes(body.decision)) {
      throw new MobileAuthError(400, "Invalid decision");
    }

    const withdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) throw new MobileAuthError(404, "Not found.");

    if (body.decision === "REJECTED" && withdrawal.status === "PENDING") {
      await prisma.$transaction(async (tx) => {
        await tx.withdrawalRequest.update({
          where: { id: withdrawalId },
          data: {
            status: "REJECTED",
            adminNote: body.adminNote ?? "Rejected",
            processedAt: new Date(),
          },
        });
        await getOrCreateWallet(withdrawal.userId, tx);
        const updated = await tx.sellerWallet.update({
          where: { userId: withdrawal.userId },
          data: { balance: { increment: withdrawal.amount } },
        });
        await tx.walletTransaction.create({
          data: {
            userId: withdrawal.userId,
            type: "CREDIT",
            amount: withdrawal.amount,
            balanceAfter: updated.balance,
            description: "Withdrawal rejected — funds restored",
          },
        });
      });
    } else if (body.decision === "APPROVED" && withdrawal.status === "PENDING") {
      await prisma.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: "APPROVED",
          adminNote: body.adminNote ?? null,
        },
      });
    } else if (
      body.decision === "COMPLETED" &&
      (withdrawal.status === "PENDING" || withdrawal.status === "APPROVED")
    ) {
      await prisma.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: "COMPLETED",
          adminNote: body.adminNote ?? null,
          processedAt: new Date(),
        },
      });
    } else {
      throw new MobileAuthError(
        400,
        `Cannot ${body.decision} from status ${withdrawal.status}.`,
      );
    }

    await logAdminAction({
      adminId: admin.id,
      action: `withdrawal_${body.decision.toLowerCase()}`,
      summary: `${body.decision} withdrawal ${withdrawalId}`,
      targetType: "WithdrawalRequest",
      targetId: withdrawalId,
      newValue: { decision: body.decision, adminNote: body.adminNote },
    });

    return jsonOk({ message: `Withdrawal ${body.decision.toLowerCase()}.` });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminListPayments(request: Request) {
  try {
    await requireMobileAuth(request, ["ADMIN"]);
    const payments = await prisma.escrowPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        escrow: {
          include: {
            project: { select: { id: true, title: true } },
            buyer: { select: { name: true, email: true } },
          },
        },
      },
    });

    return jsonOk({
      payments: payments.map((p) => ({
        id: p.id,
        status: p.status,
        channel: p.channel,
        amount: money(p.amount),
        merchantReference: p.merchantReference,
        paynowReference: p.paynowReference,
        phone: p.phone,
        createdAt: p.createdAt.toISOString(),
        project: p.escrow.project,
        buyer: p.escrow.buyer,
        escrowId: p.escrowId,
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminFinancials(request: Request) {
  try {
    await requireMobileAuth(request, ["ADMIN"]);
    const [released, fees, walletBalances, pendingWithdrawals] = await Promise.all([
      prisma.escrow.aggregate({
        where: { status: "RELEASED" },
        _sum: { amount: true, feeAmount: true },
        _count: true,
      }),
      prisma.escrow.aggregate({
        _sum: { feeAmount: true },
      }),
      prisma.sellerWallet.aggregate({
        _sum: { balance: true, pendingBalance: true },
      }),
      prisma.withdrawalRequest.aggregate({
        where: { status: { in: ["PENDING", "APPROVED"] } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return jsonOk({
      releasedVolume: money(released._sum.amount),
      releasedCount: released._count,
      totalFees: money(fees._sum.feeAmount),
      walletBalances: money(walletBalances._sum.balance),
      pendingWalletBalances: money(walletBalances._sum.pendingBalance),
      pendingWithdrawalAmount: money(pendingWithdrawals._sum.amount),
      pendingWithdrawalCount: pendingWithdrawals._count,
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminGetSettings(request: Request) {
  try {
    await requireMobileAuth(request, ["ADMIN"]);
    const settings = await getAllSettings();
    return jsonOk({ settings });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminUpdateSettings(request: Request) {
  try {
    const admin = await requireMobileAuth(request, ["ADMIN"]);
    const body = await readJsonBody<Record<string, unknown>>(request);
    const parsed = platformSettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      ...body,
    });
    if (!parsed.success) {
      throw new MobileAuthError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid settings",
      );
    }

    await ensureDefaultSettings();
    for (const [key, value] of Object.entries(parsed.data)) {
      await setSetting(key, String(value));
    }

    await logAdminAction({
      adminId: admin.id,
      action: "update_settings",
      summary: "Updated platform settings",
      targetType: "PlatformSetting",
      newValue: parsed.data,
    });

    return jsonOk({ message: "Settings saved.", settings: parsed.data });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileAdminAudit(request: Request) {
  try {
    await requireMobileAuth(request, ["ADMIN"]);
    const logs = await prisma.adminActivityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { admin: { select: { id: true, name: true, email: true } } },
    });

    return jsonOk({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        summary: l.summary,
        targetType: l.targetType,
        targetId: l.targetId,
        createdAt: l.createdAt.toISOString(),
        admin: l.admin,
      })),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}
