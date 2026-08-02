import { prisma } from "@/lib/prisma";
import { formatDate, requireRole } from "@/lib/utils";

export const metadata = { title: "Audit logs" };

export default async function AdminAuditPage() {
  await requireRole("ADMIN");

  const logs = await prisma.adminActivityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { admin: { select: { name: true, email: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-4xl">Audit logs</h1>
      <p className="mt-2 text-ink-soft">Recent admin actions across the platform.</p>

      <div className="table-wrap panel mt-8">
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Summary</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-ink-soft">No audit events yet.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap">{formatDate(log.createdAt)}</td>
                  <td>
                    <div>{log.admin.name}</div>
                    <div className="text-xs text-ink-soft">{log.admin.email}</div>
                  </td>
                  <td><span className="badge">{log.action}</span></td>
                  <td>{log.summary}</td>
                  <td className="text-sm text-ink-soft">
                    {log.targetType ? `${log.targetType}` : "—"}
                    {log.targetId ? (
                      <div className="truncate max-w-[140px]">{log.targetId}</div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
