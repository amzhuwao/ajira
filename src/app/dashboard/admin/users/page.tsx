import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <h1 className="font-display text-3xl">Users</h1>
      <div className="mt-8 space-y-2">
        {users.map((u) => (
          <div key={u.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{u.name}</div>
              <div className="text-sm text-ink-soft">
                {u.email}
                {u.phone ? ` · ${u.phone}` : ""} · {formatDate(u.createdAt)}
              </div>
            </div>
            <span className="badge">{u.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
