import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteUserAction,
  updateUserAction,
} from "@/lib/actions/users";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, requireRole } from "@/lib/utils";
import { ActionForm } from "@/components/ui/action-form";

export const metadata = { title: "Edit user · Admin" };

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("ADMIN");
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      wallet: true,
      _count: {
        select: {
          projectsAsBuyer: true,
          bids: true,
          escrowsAsBuyer: true,
          escrowsAsSeller: true,
          withdrawals: true,
          disputesOpened: true,
          services: true,
        },
      },
    },
  });

  if (!user) notFound();

  const isSelf = session.user.id === user.id;
  const marketplaceHistory =
    user._count.projectsAsBuyer +
    user._count.bids +
    user._count.escrowsAsBuyer +
    user._count.escrowsAsSeller +
    user._count.withdrawals +
    user._count.disputesOpened;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/admin/users" className="text-sm text-ink-soft">
        ← All users
      </Link>
      <h1 className="mt-4 font-display text-4xl">{user.name}</h1>
      <p className="mt-2 text-ink-soft">
        {user.email} · joined {formatDate(user.createdAt)}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Role</div>
          <div className="mt-1 font-semibold">{user.role}</div>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">Wallet</div>
          <div className="mt-1 font-semibold">
            {user.wallet ? formatMoney(user.wallet.balance) : "—"}
          </div>
        </div>
        <div className="panel">
          <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">History</div>
          <div className="mt-1 font-semibold">{marketplaceHistory} records</div>
        </div>
      </div>

      <section className="panel mt-8">
        <h2 className="font-display text-2xl">Edit account</h2>
        <ActionForm action={updateUserAction} className="mt-6 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="userId" value={user.id} />
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input
              className="input"
              id="name"
              name="name"
              defaultValue={user.name}
              required
              minLength={2}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              className="input"
              id="email"
              name="email"
              type="email"
              defaultValue={user.email}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input
              className="input"
              id="phone"
              name="phone"
              defaultValue={user.phone ?? ""}
              placeholder="07XXXXXXXX"
            />
          </div>
          <div>
            <label className="label" htmlFor="role">
              Role
            </label>
            <select
              className="select"
              id="role"
              name="role"
              defaultValue={user.role}
              required
            >
              <option value="BUYER">Buyer</option>
              <option value="SELLER">Seller</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select
              className="select"
              id="status"
              name="status"
              defaultValue={user.status}
              required
            >
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="BANNED">Banned</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="kycVerified">
              KYC verified
            </label>
            <select
              className="select"
              id="kycVerified"
              name="kycVerified"
              defaultValue={user.kycVerified ? "true" : "false"}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="password">
              New password (optional)
            </label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              minLength={8}
              placeholder="Leave blank to keep current password"
            />
          </div>
          <div className="sm:col-span-2">
            <button className="btn btn-primary" type="submit">
              Save changes
            </button>
          </div>
        </ActionForm>
      </section>

      <section className="panel mt-6">
        <h2 className="font-display text-2xl">Activity summary</h2>
        <ul className="mt-4 grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
          <li>Projects as buyer: {user._count.projectsAsBuyer}</li>
          <li>Bids: {user._count.bids}</li>
          <li>Escrows as buyer: {user._count.escrowsAsBuyer}</li>
          <li>Escrows as seller: {user._count.escrowsAsSeller}</li>
          <li>Withdrawals: {user._count.withdrawals}</li>
          <li>Disputes opened: {user._count.disputesOpened}</li>
          <li>Services: {user._count.services}</li>
        </ul>
      </section>

      <section className="panel mt-6 border-[color-mix(in_srgb,var(--danger)_35%,var(--line))]">
        <h2 className="font-display text-2xl text-danger">Delete account</h2>
        {isSelf ? (
          <p className="mt-2 text-sm text-ink-soft">
            You cannot delete the account you are signed in with.
          </p>
        ) : marketplaceHistory > 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            This account has marketplace history and cannot be deleted. Update
            their details or demote the role instead.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-soft">
              Permanently remove this account. Type <strong>DELETE</strong> to
              confirm.
            </p>
            <ActionForm action={deleteUserAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="userId" value={user.id} />
              <div className="flex-1">
                <label className="label" htmlFor="confirm">
                  Confirmation
                </label>
                <input
                  className="input"
                  id="confirm"
                  name="confirm"
                  placeholder="DELETE"
                  required
                />
              </div>
              <button className="btn btn-primary" type="submit" style={{ background: "var(--danger)" }}>
                Delete user
              </button>
            </ActionForm>
          </>
        )}
      </section>
    </div>
  );
}
