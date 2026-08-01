import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function DisputesListPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const disputes = await prisma.dispute.findMany({
    where: isAdmin
      ? undefined
      : {
          OR: [
            { openedById: session.user.id },
            { escrow: { buyerId: session.user.id } },
            { escrow: { sellerId: session.user.id } },
          ],
        },
    orderBy: { createdAt: "desc" },
    include: {
      escrow: { include: { project: true } },
      openedBy: { select: { name: true } },
    },
  });

  return (
    <div>
      <h1 className="font-display text-3xl">Disputes</h1>
      <div className="mt-8 space-y-3">
        {disputes.map((d) => (
          <Link key={d.id} href={`/dashboard/disputes/${d.id}`} className="card block">
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="font-semibold">{d.escrow.project.title}</h2>
                <p className="text-sm text-ink-soft">
                  Opened by {d.openedBy.name} · {formatDate(d.createdAt)}
                </p>
              </div>
              <span className="badge">{d.status}</span>
            </div>
          </Link>
        ))}
        {disputes.length === 0 && (
          <div className="card text-ink-soft">No disputes.</div>
        )}
      </div>
    </div>
  );
}
