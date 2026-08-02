import { BidStatus, EscrowStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function refreshSellerStatistics(userId?: string) {
  const sellers = await prisma.user.findMany({
    where: {
      role: "SELLER",
      ...(userId ? { id: userId } : {}),
    },
    select: { id: true },
  });

  for (const seller of sellers) {
    const [released, reviews, acceptedBids, totalBids] = await Promise.all([
      prisma.escrow.findMany({
        where: { sellerId: seller.id, status: EscrowStatus.RELEASED },
        select: { amount: true, feeAmount: true, bid: { select: { createdAt: true, respondedAt: true } } },
      }),
      prisma.review.findMany({
        where: { revieweeId: seller.id },
        select: { rating: true },
      }),
      prisma.bid.count({
        where: { sellerId: seller.id, status: BidStatus.ACCEPTED },
      }),
      prisma.bid.count({
        where: {
          sellerId: seller.id,
          status: { in: [BidStatus.ACCEPTED, BidStatus.REJECTED] },
        },
      }),
    ]);

    const completedJobs = released.length;
    const totalEarnings = released.reduce((sum, e) => {
      const net = new Prisma.Decimal(e.amount).minus(e.feeAmount ?? 0);
      return sum.plus(net);
    }, new Prisma.Decimal(0));

    const reviewCount = reviews.length;
    const averageRating =
      reviewCount === 0
        ? 0
        : reviews.reduce((s, r) => s + r.rating, 0) / reviewCount;

    const responseSamples = released
      .map((e) => e.bid)
      .filter((b): b is { createdAt: Date; respondedAt: Date | null } => Boolean(b?.respondedAt))
      .map((b) => (b.respondedAt!.getTime() - b.createdAt.getTime()) / (1000 * 60 * 60));

    const avgResponseHours =
      responseSamples.length === 0
        ? null
        : responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length;

    const completionRate =
      totalBids === 0 ? 0 : Math.round((acceptedBids / totalBids) * 10000) / 100;

    await prisma.sellerStatistic.upsert({
      where: { userId: seller.id },
      create: {
        userId: seller.id,
        completedJobs,
        totalEarnings,
        averageRating,
        reviewCount,
        avgResponseHours,
        completionRate,
      },
      update: {
        completedJobs,
        totalEarnings,
        averageRating,
        reviewCount,
        avgResponseHours,
        completionRate,
      },
    });
  }
}
