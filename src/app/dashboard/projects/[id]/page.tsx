import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import {
  acceptBidAction,
  markDeliveredAction,
  placeBidAction,
} from "@/lib/actions/projects";
import { submitReviewAction } from "@/lib/actions/reviews";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireSession } from "@/lib/utils";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      buyer: { select: { id: true, name: true } },
      bids: {
        include: { seller: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      escrow: true,
      reviews: {
        include: { reviewer: { select: { name: true } } },
      },
    },
  });

  if (!project) notFound();

  const isBuyer = project.buyerId === session.user.id;
  const isSeller = session.user.role === "SELLER";
  const myBid = project.bids.find((b) => b.sellerId === session.user.id);
  const acceptedBid = project.bids.find((b) => b.status === "ACCEPTED");
  const existingReview = project.reviews.find((r) => r.reviewerId === session.user.id);
  const canReview =
    isBuyer &&
    !existingReview &&
    (project.status === "COMPLETED" || project.escrow?.status === "RELEASED");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard" className="text-sm text-ink-soft">
        ← Dashboard
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="badge">{project.status}</p>
          <h1 className="mt-3 font-display text-4xl">{project.title}</h1>
          <p className="mt-2 text-ink-soft">
            Posted by {project.buyer.name} · {formatDate(project.createdAt)} ·{" "}
            {project.timeline}
          </p>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Budget</div>
          <div className="font-display text-2xl">
            {formatMoney(Number(project.budgetMin))} – {formatMoney(Number(project.budgetMax))}
          </div>
        </div>
      </div>

      <section className="panel mt-8">
        <h2 className="font-display text-2xl">Brief</h2>
        <p className="mt-3 whitespace-pre-wrap text-ink-soft">{project.description}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {project.category ? (
            <p>
              Category: <strong>{project.category}</strong>
            </p>
          ) : null}
          <p>
            Timeline: <strong>{project.timeline}</strong>
          </p>
        </div>
      </section>

      {project.escrow ? (
        <div className="mt-6">
          <Link href={`/dashboard/escrow/${project.escrow.id}`} className="btn btn-secondary">
            View escrow ({project.escrow.status})
          </Link>
        </div>
      ) : null}

      {isSeller &&
      acceptedBid?.sellerId === session.user.id &&
      project.escrow?.status === "FUNDED" &&
      (project.status === "IN_PROGRESS" || project.status === "DELIVERED") &&
      project.status !== "DELIVERED" ? (
        <form
          action={async () => {
            "use server";
            await markDeliveredAction(project.id);
          }}
          className="mt-6"
        >
          <button className="btn btn-primary" type="submit">
            Mark work delivered
          </button>
        </form>
      ) : null}

      {isSeller && project.status === "OPEN" && !myBid ? (
        <section className="panel mt-8">
          <h2 className="font-display text-2xl">Place a bid</h2>
          <ActionForm action={placeBidAction} className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="projectId" value={project.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="amount">
                  Bid amount (USD)
                </label>
                <input className="input" id="amount" name="amount" type="number" step="0.01" required />
              </div>
              <div>
                <label className="label" htmlFor="deliveryDays">
                  Delivery days
                </label>
                <input className="input" id="deliveryDays" name="deliveryDays" type="number" min={1} required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="proposal">
                Proposal
              </label>
              <textarea className="textarea" id="proposal" name="proposal" required minLength={20} />
            </div>
            <button className="btn btn-primary self-start" type="submit">
              Submit bid
            </button>
          </ActionForm>
        </section>
      ) : null}

      {myBid ? (
        <p className="mt-6 text-sm text-ink-soft">
          Your bid: {formatMoney(Number(myBid.amount))} · {myBid.status}
        </p>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-2xl">Bids ({project.bids.length})</h2>
        <div className="mt-4 space-y-3">
          {project.bids.map((bid) => (
            <div key={bid.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/dashboard/sellers/${bid.seller.id}`}
                    className="font-semibold text-forest"
                  >
                    {bid.seller.name}
                  </Link>
                  <div className="text-sm text-ink-soft">
                    {formatMoney(Number(bid.amount))} · {bid.deliveryDays} days · {bid.status}
                  </div>
                </div>
                {isBuyer && project.status === "OPEN" && bid.status === "PENDING" ? (
                  <form
                    action={async () => {
                      "use server";
                      await acceptBidAction(bid.id);
                    }}
                  >
                    <button className="btn btn-primary" type="submit">
                      Accept bid
                    </button>
                  </form>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">{bid.proposal}</p>
            </div>
          ))}
        </div>
      </section>

      {canReview ? (
        <section className="panel mt-10">
          <h2 className="font-display text-2xl">Leave a review</h2>
          <ActionForm action={submitReviewAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div>
              <label className="label" htmlFor="rating">Rating</label>
              <select className="select" id="rating" name="rating" defaultValue="5" required>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} stars</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="comment">Comment</label>
              <textarea className="textarea" id="comment" name="comment" />
            </div>
            <button className="btn btn-primary self-start" type="submit">
              Submit review
            </button>
          </ActionForm>
        </section>
      ) : null}

      {project.reviews.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl">Reviews</h2>
          <div className="mt-4 space-y-3">
            {project.reviews.map((review) => (
              <div key={review.id} className="panel">
                <div className="font-semibold">
                  {review.rating}★ · {review.reviewer.name}
                </div>
                {review.comment ? (
                  <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap">{review.comment}</p>
                ) : null}
                {review.replyText ? (
                  <p className="mt-3 rounded-xl bg-sand/50 p-3 text-sm">
                    <strong>Seller reply:</strong> {review.replyText}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
