import Link from "next/link";
import { createUserAction } from "@/lib/actions/users";
import { prisma } from "@/lib/prisma";
import { formatDate, requireRole } from "@/lib/utils";
import { ActionForm } from "@/components/ui/action-form";

export const metadata = { title: "Users · Admin" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  await requireRole("ADMIN");
  const { q, role } = await searchParams;
  const query = (q ?? "").trim();
  const roleFilter = role && ["BUYER", "SELLER", "ADMIN"].includes(role) ? role : undefined;

  const users = await prisma.user.findMany({
    where: {
      AND: [
        roleFilter ? { role: roleFilter as "BUYER" | "SELLER" | "ADMIN" } : {},
        query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
      _count: {
        select: {
          projectsAsBuyer: true,
          bids: true,
          escrowsAsBuyer: true,
          escrowsAsSeller: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Users</h1>
          <p className="mt-2 text-ink-soft">
            Create, update, and remove platform accounts.
          </p>
        </div>
        <Link href="/dashboard/admin/users#create" className="btn btn-primary">
          New user
        </Link>
      </div>

      <form className="panel mt-8 grid gap-3 sm:grid-cols-[1fr_auto_auto]" method="get">
        <div>
          <label className="label" htmlFor="q">
            Search
          </label>
          <input
            className="input"
            id="q"
            name="q"
            defaultValue={query}
            placeholder="Name, email, or phone"
          />
        </div>
        <div>
          <label className="label" htmlFor="role">
            Role
          </label>
          <select className="select" id="role" name="role" defaultValue={roleFilter ?? ""}>
            <option value="">All roles</option>
            <option value="BUYER">Buyer</option>
            <option value="SELLER">Seller</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn btn-secondary w-full" type="submit">
            Filter
          </button>
        </div>
      </form>

      <div className="table-wrap panel mt-6">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Activity</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const activity =
                u._count.projectsAsBuyer +
                u._count.bids +
                u._count.escrowsAsBuyer +
                u._count.escrowsAsSeller;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="font-semibold">{u.name}</div>
                    {u.phone ? (
                      <div className="text-xs text-ink-soft">{u.phone}</div>
                    ) : null}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge">{u.role}</span>
                  </td>
                  <td className="text-sm text-ink-soft">
                    {activity} records
                  </td>
                  <td className="text-sm text-ink-soft">{formatDate(u.createdAt)}</td>
                  <td>
                    <Link
                      href={`/dashboard/admin/users/${u.id}`}
                      className="btn btn-secondary"
                      style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">No users match this filter.</p>
        ) : null}
      </div>

      <section id="create" className="panel mt-10">
        <h2 className="font-display text-2xl">Create user</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Admins can create buyer, seller, or admin accounts.
        </p>
        <ActionForm action={createUserAction} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input className="input" id="name" name="name" required minLength={2} />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input className="input" id="email" name="email" type="email" required />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input className="input" id="phone" name="phone" placeholder="07XXXXXXXX" />
          </div>
          <div>
            <label className="label" htmlFor="role">
              Role
            </label>
            <select className="select" id="role" name="role" defaultValue="BUYER" required>
              <option value="BUYER">Buyer</option>
              <option value="SELLER">Seller</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="password">
              Temporary password
            </label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <button className="btn btn-primary" type="submit">
              Create account
            </button>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
