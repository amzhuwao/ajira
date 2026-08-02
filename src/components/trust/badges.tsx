import Link from "next/link";
import { getSellerBadges } from "@/lib/badges";

type StatsProp = {
  averageRating?: unknown;
  reviewCount?: number | null;
  completedJobs?: number | null;
  completionRate?: unknown;
} | null;

export function TrustBadges({
  kycVerified,
  statistics,
}: {
  kycVerified?: boolean;
  statistics?: StatsProp;
}) {
  const badges = getSellerBadges({
    kycVerified,
    statistics: statistics
      ? {
          averageRating: Number(statistics.averageRating ?? 0),
          reviewCount: statistics.reviewCount,
          completedJobs: statistics.completedJobs,
          completionRate: Number(statistics.completionRate ?? 0),
        }
      : null,
  });
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <span key={b.key} className="badge">
          {b.label}
        </span>
      ))}
    </div>
  );
}

export function SellerCardLink({
  href,
  name,
  tagline,
  kycVerified,
  statistics,
}: {
  href: string;
  name: string;
  tagline?: string | null;
  kycVerified?: boolean;
  statistics?: StatsProp;
}) {
  return (
    <Link href={href} className="card block">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-forest">{name}</h2>
          <p className="mt-1 text-sm text-ink-soft">{tagline || "Seller on Ajira"}</p>
        </div>
        <TrustBadges kycVerified={kycVerified} statistics={statistics} />
      </div>
      {statistics ? (
        <p className="mt-3 text-sm text-ink-soft">
          {Number(statistics.averageRating ?? 0).toFixed(1)}★ · {statistics.completedJobs ?? 0}{" "}
          jobs · {Number(statistics.completionRate ?? 0).toFixed(0)}% completion
        </p>
      ) : null}
    </Link>
  );
}
