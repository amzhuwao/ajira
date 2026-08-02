import Link from "next/link";
import { SellerCardLink } from "@/components/trust/badges";
import { toggleFavoriteSellerAction } from "@/lib/actions/hiring";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/utils";

export const metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const session = await requireRole("BUYER", "ADMIN");

  const favorites = await prisma.favoriteSeller.findMany({
    where: { buyerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      seller: {
        include: { statistics: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl">Favorite sellers</h1>
      <p className="mt-2 text-ink-soft">Your shortlist for future projects.</p>

      <div className="mt-8 space-y-3">
        {favorites.length === 0 ? (
          <div className="panel text-ink-soft">
            No favorites yet. Browse{" "}
            <Link href="/dashboard/talent" className="text-forest">
              talent
            </Link>{" "}
            and save sellers you like.
          </div>
        ) : (
          favorites.map((fav) => (
            <div key={fav.id} className="space-y-2">
              <SellerCardLink
                href={`/dashboard/sellers/${fav.seller.id}`}
                name={fav.seller.name}
                tagline={fav.seller.tagline}
                kycVerified={fav.seller.kycVerified}
                statistics={fav.seller.statistics}
              />
              <form
                action={async () => {
                  "use server";
                  await toggleFavoriteSellerAction(fav.sellerId);
                }}
              >
                <button className="btn btn-ghost" type="submit">
                  Remove
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
