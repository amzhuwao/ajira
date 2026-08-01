import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";

export default async function BuyerProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== Role.BUYER && session.user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  const projects = await prisma.project.findMany({
    where:
      session.user.role === Role.ADMIN ? undefined : { buyerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bids: true } }, escrow: true },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Projects</h1>
        {session.user.role === Role.BUYER && (
          <Link href="/dashboard/projects/new" className="btn btn-primary">
            New project
          </Link>
        )}
      </div>
      <div className="mt-8 space-y-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="card block">
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="font-semibold">{p.title}</h2>
                <p className="text-sm text-ink-soft">
                  {formatMoney(p.budgetMin)}–{formatMoney(p.budgetMax)} · {p._count.bids}{" "}
                  bids
                  {p.escrow ? ` · escrow ${p.escrow.status}` : ""}
                </p>
              </div>
              <span className="badge">{p.status}</span>
            </div>
          </Link>
        ))}
        {projects.length === 0 && (
          <div className="card text-ink-soft">No projects yet.</div>
        )}
      </div>
    </div>
  );
}
