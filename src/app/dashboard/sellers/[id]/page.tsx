import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { TrustBadges } from "@/components/trust/badges";
import { inviteSellerAction, toggleFavoriteSellerAction } from "@/lib/actions/hiring";
import { orderServiceAction } from "@/lib/actions/commerce";
import { replyToReviewAction } from "@/lib/actions/reviews";
import { recordProfileView } from "@/lib/actions/profile";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireSession } from "@/lib/utils";

export default async function SellerPublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const seller = await prisma.user.findFirst({
    where: { id, role: "SELLER" },
    include: {
      statistics: true,
      services: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      },
      reviewsReceived: {
        include: {
          reviewer: { select: { name: true } },
          project: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!seller) notFound();

  await recordProfileView(seller.id);

  const isOwner = session.user.id === seller.id;
  const isBuyer = session.user.role === "BUYER" || session.user.role === "ADMIN";

  const [favorite, openProjects] = await Promise.all([
    isBuyer
      ? prisma.favoriteSeller.findUnique({
          where: {
            buyerId_sellerId: { buyerId: session.user.id, sellerId: seller.id },
          },
        })
      : null,
    isBuyer
      ? prisma.project.findMany({
          where: { buyerId: session.user.id, status: "OPEN" },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      {seller.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={seller.coverImageUrl}
          alt={`${seller.name} cover`}
          className="mb-6 h-40 w-full rounded-2xl object-cover"
        />
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        {seller.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={seller.profileImageUrl}
            alt={`${seller.name} profile photo`}
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sand font-display text-2xl">
            {seller.name.slice(0, 1)}
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-4xl">{seller.name}</h1>
          </div>
          <div className="mt-2">
            <TrustBadges kycVerified={seller.kycVerified} statistics={seller.statistics} />
          </div>
          <p className="mt-2 text-ink-soft">{seller.tagline || "Seller on Ajira"}</p>
          <p className="mt-2 text-sm text-ink-soft">
            {seller.availability} · {seller.profileViews} profile views
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner ? (
            <Link href="/dashboard/profile" className="btn btn-secondary">
              Edit profile
            </Link>
          ) : null}
          {isBuyer && !isOwner ? (
            <form
              action={async () => {
                "use server";
                await toggleFavoriteSellerAction(seller.id);
              }}
            >
              <button className="btn btn-secondary" type="submit">
                {favorite ? "Unfavorite" : "Save to favorites"}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {isBuyer && !isOwner && openProjects.length > 0 ? (
        <section className="panel mt-8">
          <h2 className="font-display text-2xl">Invite to bid</h2>
          <ActionForm action={inviteSellerAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="sellerId" value={seller.id} />
            <div>
              <label className="label" htmlFor="projectId">Open project</label>
              <select className="select" id="projectId" name="projectId" required>
                {openProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="textarea"
              name="message"
              placeholder="Optional note to the seller"
            />
            <button className="btn btn-primary self-start" type="submit">
              Send invite
            </button>
          </ActionForm>
        </section>
      ) : null}

      {seller.statistics ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="panel">
            <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Rating</div>
            <div className="mt-1 font-display text-2xl">
              {Number(seller.statistics.averageRating).toFixed(1)}★
            </div>
          </div>
          <div className="panel">
            <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Jobs</div>
            <div className="mt-1 font-display text-2xl">{seller.statistics.completedJobs}</div>
          </div>
          <div className="panel">
            <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Completion</div>
            <div className="mt-1 font-display text-2xl">
              {Number(seller.statistics.completionRate).toFixed(0)}%
            </div>
          </div>
          <div className="panel">
            <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Earned</div>
            <div className="mt-1 font-display text-2xl">
              {formatMoney(seller.statistics.totalEarnings)}
            </div>
          </div>
        </div>
      ) : null}

      {seller.bio ? (
        <section className="panel mt-8">
          <h2 className="font-display text-2xl">About</h2>
          <p className="mt-3 whitespace-pre-wrap text-ink-soft">{seller.bio}</p>
          {seller.skills ? (
            <p className="mt-4 text-sm">
              <strong>Skills:</strong> {seller.skills}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="font-display text-2xl">Services</h2>
        <div className="mt-4 space-y-3">
          {seller.services.length === 0 ? (
            <p className="text-ink-soft">No active services listed.</p>
          ) : (
            seller.services.map((service) => (
              <div key={service.id} className="panel">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{service.title}</strong>
                  <span>{formatMoney(service.price)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {service.deliveryDays} days
                  {service.category ? ` · ${service.category}` : ""}
                </p>
                <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap">
                  {service.description}
                </p>
                {service.deliverables ? (
                  <p className="mt-2 text-sm">
                    <strong>Includes:</strong> {service.deliverables}
                  </p>
                ) : null}
                {isBuyer && !isOwner ? (
                  <ActionForm action={orderServiceAction} className="mt-3 flex flex-col gap-2">
                    <input type="hidden" name="serviceId" value={service.id} />
                    <button className="btn btn-primary self-start" type="submit">
                      Order now
                    </button>
                  </ActionForm>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Reviews</h2>
        <div className="mt-4 space-y-3">
          {seller.reviewsReceived.length === 0 ? (
            <p className="text-ink-soft">No reviews yet.</p>
          ) : (
            seller.reviewsReceived.map((review) => (
              <div key={review.id} className="panel">
                <div className="font-semibold">
                  {review.rating}★ · {review.reviewer.name}
                </div>
                <div className="text-xs text-ink-soft">
                  {review.project.title} · {formatDate(review.createdAt)}
                </div>
                {review.comment ? (
                  <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap">{review.comment}</p>
                ) : null}
                {review.replyText ? (
                  <p className="mt-3 rounded-xl bg-sand/50 p-3 text-sm">
                    <strong>Seller reply:</strong> {review.replyText}
                  </p>
                ) : isOwner ? (
                  <ActionForm action={replyToReviewAction} className="mt-3 flex flex-col gap-2">
                    <input type="hidden" name="reviewId" value={review.id} />
                    <textarea className="textarea" name="replyText" required minLength={2} placeholder="Reply to this review…" />
                    <button className="btn btn-secondary self-start" type="submit">
                      Post reply
                    </button>
                  </ActionForm>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
