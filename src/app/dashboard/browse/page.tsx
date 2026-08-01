import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";

export default async function BrowsePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  const projects = await prisma.project.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      buyer: { select: { name: true } },
      _count: { select: { bids: true } },
    },
  });

  return (
    <div>
      <h1 className="font-display text-3xl">Open projects</h1>
      <p className="mt-1 text-ink-soft">Browse and bid in USD</p>
      <div className="mt-8 space-y-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="card block">
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="font-semibold">{p.title}</h2>
                <p className="text-sm text-ink-soft">
                  {p.buyer.name} · {formatMoney(p.budgetMin)}–{formatMoney(p.budgetMax)} ·{" "}
                  {p._count.bids} bids
                </p>
              </div>
              <span className="badge">OPEN</span>
            </div>
          </Link>
        ))}
        {projects.length === 0 && (
          <div className="card text-ink-soft">No open projects right now.</div>
        )}
      </div>
    </div>
  );
}
