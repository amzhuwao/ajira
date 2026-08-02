import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, requireRole } from "@/lib/utils";

export const metadata = { title: "Audit logs" };

function JsonBlock({ value }: { value: unknown }) {
  if (value == null) return <span className="text-ink-soft">—</span>;
  return (
    <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-sand/60 p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; admin?: string; id?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const actionFilter = params.action?.trim() ?? "";
  const adminFilter = params.admin?.trim() ?? "";
  const detailId = params.id?.trim() ?? "";

  const [logs, admins, actions, detail] = await Promise.all([
    prisma.adminActivityLog.findMany({
      where: {
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(adminFilter ? { adminId: adminFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { admin: { select: { id: true, name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.adminActivityLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    detailId
      ? prisma.adminActivityLog.findUnique({
          where: { id: detailId },
          include: { admin: { select: { name: true, email: true } } },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-4xl">Audit logs</h1>
      <p className="mt-2 text-ink-soft">Recent admin actions across the platform.</p>

      <form className="mt-6 flex flex-wrap gap-2" method="get">
        <select className="input" name="action" defaultValue={actionFilter}>
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a.action} value={a.action}>
              {a.action}
            </option>
          ))}
        </select>
        <select className="input" name="admin" defaultValue={adminFilter}>
          <option value="">All admins</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>

      {detail ? (
        <section className="panel mt-6 border-l-4 border-l-forest">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">{detail.action}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {detail.admin.name} · {detail.admin.email} · {formatDate(detail.createdAt)}
              </p>
            </div>
            <Link href="/dashboard/admin/audit" className="btn btn-ghost">
              Close detail
            </Link>
          </div>
          <p className="mt-4">{detail.summary}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-soft">Target</dt>
              <dd>
                {detail.targetType ?? "—"}
                {detail.targetId ? ` · ${detail.targetId}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-ink-soft">IP / UA</dt>
              <dd className="break-all">
                {detail.ipAddress ?? "—"}
                {detail.userAgent ? (
                  <div className="mt-1 text-xs text-ink-soft line-clamp-2">{detail.userAgent}</div>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-ink-soft">Before</dt>
              <dd>
                <JsonBlock value={detail.oldValue} />
              </dd>
            </div>
            <div>
              <dt className="text-ink-soft">After</dt>
              <dd>
                <JsonBlock value={detail.newValue} />
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <div className="table-wrap panel mt-8">
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Summary</th>
              <th>Target</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-ink-soft">
                  No audit events yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const qs = new URLSearchParams();
                if (actionFilter) qs.set("action", actionFilter);
                if (adminFilter) qs.set("admin", adminFilter);
                qs.set("id", log.id);
                return (
                  <tr key={log.id} data-active={detailId === log.id ? "true" : undefined}>
                    <td className="whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td>
                      <div>{log.admin.name}</div>
                      <div className="text-xs text-ink-soft">{log.admin.email}</div>
                    </td>
                    <td>
                      <span className="badge">{log.action}</span>
                    </td>
                    <td>{log.summary}</td>
                    <td className="text-sm text-ink-soft">
                      {log.targetType ? `${log.targetType}` : "—"}
                      {log.targetId ? (
                        <div className="truncate max-w-[140px]">{log.targetId}</div>
                      ) : null}
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/admin/audit?${qs.toString()}`}
                        className="text-sm text-forest"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
