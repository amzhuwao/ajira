export type TrustBadge = {
  key: "kyc" | "top_rated" | "rising" | "reliable";
  label: string;
};

type SellerStatsLike = {
  averageRating?: number | string | null;
  reviewCount?: number | null;
  completedJobs?: number | null;
  completionRate?: number | string | null;
} | null;

export function getSellerBadges(params: {
  kycVerified?: boolean;
  statistics?: SellerStatsLike;
}): TrustBadge[] {
  const badges: TrustBadge[] = [];
  const stats = params.statistics;
  const rating = Number(stats?.averageRating ?? 0);
  const reviews = stats?.reviewCount ?? 0;
  const jobs = stats?.completedJobs ?? 0;
  const completion = Number(stats?.completionRate ?? 0);

  if (params.kycVerified) {
    badges.push({ key: "kyc", label: "ID verified" });
  }

  if (rating >= 4.7 && reviews >= 5 && jobs >= 5) {
    badges.push({ key: "top_rated", label: "Top rated" });
  } else if (rating >= 4.5 && reviews >= 2 && jobs >= 1 && jobs < 10) {
    badges.push({ key: "rising", label: "Rising talent" });
  }

  if (completion >= 90 && jobs >= 3) {
    badges.push({ key: "reliable", label: "High completion" });
  }

  return badges;
}
