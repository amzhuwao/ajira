import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";

export const metadata = { title: "Buyer dashboard" };

export default async function BuyerDashboardPage() {
  const session = await requireRole("BUYER", "ADMIN");

  const projects = await prisma.project.findMany({
    where: { buyerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { bids: true } },
      escrow: true,
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Buyer overview</h1>
          <p className="mt-2 text-ink-soft">
            Post work, review bids, and fund escrow with Paynow.
          </p>
        </div>
        <Link href="/dashboard/projects/new" className="btn btn-primary">
          Post a project
        </Link>
      </div>

      <section id="projects" className="mt-10">
        <h2 className="font-display text-2xl">Your projects</h2>
        <div className="table-wrap mt-4 panel">
          <table className="data">
            <thead>
              <tr>
                <th>Project</th>
                <th>Budget</th>
                <th>Bids</th>
                <th>Status</th>
                <th>Escrow</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-ink-soft">
                    No projects yet. Post your first brief to get bids.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="font-semibold text-forest"
                      >
                        {project.title}
                      </Link>
                      <div className="text-xs text-ink-soft">
                        {formatDate(project.createdAt)}
                      </div>
                    </td>
                    <td>
                      {formatMoney(Number(project.budgetMin))} –{" "}
                      {formatMoney(Number(project.budgetMax))}
                    </td>
                    <td>{project._count.bids}</td>
                    <td>
                      <span className="badge">{project.status}</span>
                    </td>
                    <td>
                      {project.escrow ? (
                        <Link
                          href={`/dashboard/escrow/${project.escrow.id}`}
                          className="text-forest underline-offset-2 hover:underline"
                        >
                          {project.escrow.status}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
