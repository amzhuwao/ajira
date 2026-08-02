import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import {
  cancelProjectAction,
  reassignSellerAction,
} from "@/lib/actions/admin";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";

export const metadata = { title: "Admin projects" };

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole("ADMIN");
  const { q, status } = await searchParams;

  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { buyer: { name: { contains: q, mode: "insensitive" } } },
              { buyer: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      buyer: { select: { name: true, email: true } },
      acceptedBid: { include: { seller: { select: { id: true, name: true, email: true } } } },
      escrow: true,
      _count: { select: { bids: true } },
    },
  });

  const sellers = await prisma.user.findMany({
    where: { role: "SELLER", status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-4xl">Projects</h1>
      <p className="mt-2 text-ink-soft">Search, cancel, or reassign sellers before funding.</p>

      <form className="panel mt-6 grid gap-3 sm:grid-cols-3">
        <input className="input" name="q" placeholder="Search title or buyer" defaultValue={q ?? ""} />
        <select className="select" name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>
          {["OPEN", "IN_PROGRESS", "DELIVERED", "COMPLETED", "CANCELLED", "DISPUTED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>

      <div className="mt-8 space-y-4">
        {projects.map((project) => (
          <div key={project.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/dashboard/projects/${project.id}`} className="font-semibold text-forest">
                  {project.title}
                </Link>
                <div className="text-sm text-ink-soft">
                  {project.buyer.name} · {formatDate(project.createdAt)} · {project._count.bids} bids
                </div>
                <div className="mt-1 text-sm">
                  {formatMoney(project.budgetMin)} – {formatMoney(project.budgetMax)} ·{" "}
                  <span className="badge">{project.status}</span>
                  {project.escrow ? (
                    <> · escrow <Link href={`/dashboard/escrow/${project.escrow.id}`}>{project.escrow.status}</Link></>
                  ) : null}
                </div>
                {project.acceptedBid ? (
                  <div className="mt-1 text-sm text-ink-soft">
                    Seller: {project.acceptedBid.seller.name} ({project.acceptedBid.seller.email})
                  </div>
                ) : null}
              </div>
              {project.status !== "CANCELLED" && project.status !== "COMPLETED" ? (
                <form
                  action={async () => {
                    "use server";
                    await cancelProjectAction(project.id);
                  }}
                >
                  <button className="btn btn-ghost" type="submit">Cancel project</button>
                </form>
              ) : null}
            </div>

            {project.escrow?.status === "PENDING" ? (
              <ActionForm action={reassignSellerAction} className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="projectId" value={project.id} />
                <div className="min-w-[220px] flex-1">
                  <label className="label" htmlFor={`seller-${project.id}`}>Reassign seller</label>
                  <select className="select" id={`seller-${project.id}`} name="sellerId" required>
                    <option value="">Select seller…</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-secondary" type="submit">Reassign</button>
              </ActionForm>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
