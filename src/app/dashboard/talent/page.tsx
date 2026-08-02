import { Prisma, SellerAvailability } from "@prisma/client";
import { SellerCardLink } from "@/components/trust/badges";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/utils";

export const metadata = { title: "Find talent" };

export default async function TalentDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("BUYER", "ADMIN");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const availability = typeof sp.availability === "string" ? sp.availability : "";
  const kycOnly = sp.kyc === "1";
  const minRating = typeof sp.minRating === "string" ? Number(sp.minRating) : NaN;

  const where: Prisma.UserWhereInput = {
    role: "SELLER",
    status: "ACTIVE",
  };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { tagline: { contains: q, mode: "insensitive" } },
      { skills: { contains: q, mode: "insensitive" } },
      { bio: { contains: q, mode: "insensitive" } },
    ];
  }
  if (
    availability &&
    Object.values(SellerAvailability).includes(availability as SellerAvailability)
  ) {
    where.availability = availability as SellerAvailability;
  }
  if (kycOnly) where.kycVerified = true;
  if (Number.isFinite(minRating) && minRating > 0) {
    where.statistics = { averageRating: { gte: minRating } };
  }

  const sellers = await prisma.user.findMany({
    where,
    include: { statistics: true },
    orderBy: [{ statistics: { averageRating: "desc" } }, { profileViews: "desc" }],
    take: 60,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-4xl">Find talent</h1>
      <p className="mt-2 text-ink-soft">
        Search sellers by skills, rating, availability, and KYC status.
      </p>

      <form className="panel mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className="input" name="q" placeholder="Skills or name" defaultValue={q} />
        <select className="select" name="availability" defaultValue={availability}>
          <option value="">Any availability</option>
          <option value="AVAILABLE">Available</option>
          <option value="BUSY">Busy</option>
          <option value="UNAVAILABLE">Unavailable</option>
        </select>
        <select className="select" name="minRating" defaultValue={Number.isFinite(minRating) ? String(minRating) : ""}>
          <option value="">Any rating</option>
          <option value="4">4.0+</option>
          <option value="4.5">4.5+</option>
          <option value="4.8">4.8+</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="kyc" value="1" defaultChecked={kycOnly} />
          KYC verified only
        </label>
        <button className="btn btn-primary sm:col-span-2 lg:col-span-4 self-start" type="submit">
          Search talent
        </button>
      </form>

      <div className="mt-8 space-y-3">
        {sellers.map((seller) => (
          <SellerCardLink
            key={seller.id}
            href={`/dashboard/sellers/${seller.id}`}
            name={seller.name}
            tagline={seller.tagline}
            kycVerified={seller.kycVerified}
            statistics={seller.statistics}
          />
        ))}
        {sellers.length === 0 ? (
          <div className="panel text-ink-soft">No sellers match these filters.</div>
        ) : null}
      </div>
    </div>
  );
}
