import Link from "next/link";
import { Prisma, ProjectTimeline } from "@prisma/client";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Browse projects" };

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category.trim() : "";
  const timeline = typeof sp.timeline === "string" ? sp.timeline : "";
  const minBudget = typeof sp.minBudget === "string" ? Number(sp.minBudget) : NaN;
  const maxBudget = typeof sp.maxBudget === "string" ? Number(sp.maxBudget) : NaN;

  const where: Prisma.ProjectWhereInput = { status: "OPEN" };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) where.category = { contains: category, mode: "insensitive" };
  if (timeline && Object.values(ProjectTimeline).includes(timeline as ProjectTimeline)) {
    where.timeline = timeline as ProjectTimeline;
  }
  if (Number.isFinite(minBudget) && minBudget > 0) {
    where.budgetMax = { ...(where.budgetMax as object), gte: minBudget };
  }
  if (Number.isFinite(maxBudget) && maxBudget > 0) {
    where.budgetMin = { ...(where.budgetMin as object), lte: maxBudget };
  }

  const [projects, categories] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        buyer: { select: { name: true } },
        _count: { select: { bids: true } },
      },
      take: 100,
    }),
    prisma.project.findMany({
      where: { status: "OPEN", category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      take: 40,
    }),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl">Open projects</h1>
      <p className="mt-1 text-ink-soft">Filter by keyword, category, budget, and timeline</p>

      <form className="panel mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input" name="q" placeholder="Keyword" defaultValue={q} />
        <input
          className="input"
          name="category"
          placeholder="Category"
          defaultValue={category}
          list="browse-categories"
        />
        <datalist id="browse-categories">
          {categories.map((c) =>
            c.category ? (
              <option key={c.category} value={c.category} />
            ) : null,
          )}
        </datalist>
        <select className="select" name="timeline" defaultValue={timeline}>
          <option value="">Any timeline</option>
          <option value="URGENT">Urgent</option>
          <option value="SHORT">Short</option>
          <option value="MEDIUM">Medium</option>
          <option value="FLEXIBLE">Flexible</option>
        </select>
        <input
          className="input"
          name="minBudget"
          type="number"
          step="0.01"
          placeholder="Min budget"
          defaultValue={Number.isFinite(minBudget) ? String(minBudget) : ""}
        />
        <input
          className="input"
          name="maxBudget"
          type="number"
          step="0.01"
          placeholder="Max budget"
          defaultValue={Number.isFinite(maxBudget) ? String(maxBudget) : ""}
        />
        <button className="btn btn-primary sm:col-span-2 lg:col-span-5 self-start" type="submit">
          Apply filters
        </button>
      </form>

      <div className="mt-8 space-y-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="card block">
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="font-semibold">{p.title}</h2>
                <p className="text-sm text-ink-soft">
                  {p.buyer.name} · {formatMoney(p.budgetMin)}–{formatMoney(p.budgetMax)} ·{" "}
                  {p.timeline}
                  {p.category ? ` · ${p.category}` : ""} · {p._count.bids} bids
                </p>
              </div>
              <span className="badge">OPEN</span>
            </div>
          </Link>
        ))}
        {projects.length === 0 && (
          <div className="card text-ink-soft">No projects match these filters.</div>
        )}
      </div>
    </div>
  );
}
