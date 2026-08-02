import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import type { Role } from "@prisma/client";

const linksByRole: Record<Role, { href: string; label: string }[]> = {
  BUYER: [
    { href: "/dashboard/buyer", label: "Overview" },
    { href: "/dashboard/projects", label: "My projects" },
    { href: "/dashboard/projects/new", label: "Post project" },
    { href: "/dashboard/disputes", label: "Disputes" },
    { href: "/dashboard/profile", label: "Profile" },
  ],
  SELLER: [
    { href: "/dashboard/seller", label: "Overview" },
    { href: "/dashboard/browse", label: "Browse projects" },
    { href: "/dashboard/services", label: "Services" },
    { href: "/dashboard/wallet", label: "Wallet" },
    { href: "/dashboard/disputes", label: "Disputes" },
    { href: "/dashboard/profile", label: "Profile" },
  ],
  ADMIN: [
    { href: "/dashboard/admin", label: "Overview" },
    { href: "/dashboard/admin/escrows", label: "Escrows" },
    { href: "/dashboard/admin/withdrawals", label: "Withdrawals" },
    { href: "/dashboard/admin/projects", label: "Projects" },
    { href: "/dashboard/admin/users", label: "Users" },
    { href: "/dashboard/admin/financials", label: "Financials" },
    { href: "/dashboard/admin/settings", label: "Settings" },
    { href: "/dashboard/admin/audit", label: "Audit logs" },
    { href: "/dashboard/disputes", label: "Disputes" },
    { href: "/dashboard/profile", label: "Profile" },
  ],
};

export function AppSidebar({
  role,
  name,
  pathname,
}: {
  role: Role;
  name: string;
  pathname: string;
}) {
  const links = linksByRole[role];

  return (
    <aside className="sidebar">
      <div className="mb-8">
        <Link href="/" className="font-display text-2xl text-cream">
          Ajira
        </Link>
        <p className="mt-2 text-sm text-[rgba(247,243,236,0.65)]">{name}</p>
        <p className="text-xs uppercase tracking-[0.14em] text-forest-glow">{role}</p>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            data-active={pathname === link.href || pathname.startsWith(link.href + "/")}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <form action={logoutAction} className="mt-10">
        <button type="submit" className="btn btn-ghost w-full">
          Log out
        </button>
      </form>
    </aside>
  );
}
