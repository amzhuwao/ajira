"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { logoutAction } from "@/lib/actions/auth";
import type { Role } from "@prisma/client";

type NavItem = { href: string; label: string };
type NavSection = { id: string; label: string; items: NavItem[] };

const sectionsByRole: Record<Role, NavSection[]> = {
  BUYER: [
    {
      id: "home",
      label: "Home",
      items: [{ href: "/dashboard/buyer", label: "Overview" }],
    },
    {
      id: "work",
      label: "Work",
      items: [
        { href: "/dashboard/projects", label: "My projects" },
        { href: "/dashboard/projects/new", label: "Post project" },
        { href: "/dashboard/messages", label: "Messages" },
        { href: "/dashboard/disputes", label: "Disputes" },
      ],
    },
    {
      id: "hire",
      label: "Hire",
      items: [
        { href: "/dashboard/talent", label: "Find talent" },
        { href: "/dashboard/catalog", label: "Service catalog" },
        { href: "/dashboard/favorites", label: "Favorites" },
      ],
    },
    {
      id: "account",
      label: "Account",
      items: [
        { href: "/dashboard/notifications", label: "Notifications" },
        { href: "/dashboard/profile", label: "Profile" },
      ],
    },
  ],
  SELLER: [
    {
      id: "home",
      label: "Home",
      items: [{ href: "/dashboard/seller", label: "Overview" }],
    },
    {
      id: "work",
      label: "Work",
      items: [
        { href: "/dashboard/browse", label: "Browse projects" },
        { href: "/dashboard/services", label: "My services" },
        { href: "/dashboard/messages", label: "Messages" },
        { href: "/dashboard/disputes", label: "Disputes" },
      ],
    },
    {
      id: "earn",
      label: "Earn",
      items: [
        { href: "/dashboard/catalog", label: "Service catalog" },
        { href: "/dashboard/wallet", label: "Wallet" },
      ],
    },
    {
      id: "account",
      label: "Account",
      items: [
        { href: "/dashboard/notifications", label: "Notifications" },
        { href: "/dashboard/profile", label: "Profile" },
      ],
    },
  ],
  ADMIN: [
    {
      id: "home",
      label: "Home",
      items: [{ href: "/dashboard/admin", label: "Overview" }],
    },
    {
      id: "management",
      label: "Management",
      items: [
        { href: "/dashboard/admin/users", label: "Users" },
        { href: "/dashboard/admin/projects", label: "Projects" },
        { href: "/dashboard/admin/escrows", label: "Escrows" },
        { href: "/dashboard/admin/disputes", label: "Disputes" },
      ],
    },
    {
      id: "financial",
      label: "Financial",
      items: [
        { href: "/dashboard/admin/financials", label: "Financials" },
        { href: "/dashboard/admin/withdrawals", label: "Withdrawals" },
        { href: "/dashboard/admin/payments", label: "Payments" },
      ],
    },
    {
      id: "compliance",
      label: "Compliance",
      items: [
        { href: "/dashboard/admin/audit", label: "Audit logs" },
        { href: "/dashboard/admin/settings", label: "Settings" },
        { href: "/dashboard/notifications", label: "Notifications" },
        { href: "/dashboard/profile", label: "Profile" },
      ],
    },
  ],
};

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (
    href === "/dashboard/admin" ||
    href === "/dashboard/buyer" ||
    href === "/dashboard/seller" ||
    href === "/dashboard"
  ) {
    return false;
  }
  return pathname.startsWith(href + "/");
}

function findTrail(sections: NavSection[], pathname: string) {
  let best: { section: NavSection; item: NavItem } | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      if (!isActive(pathname, item.href)) continue;
      if (!best || item.href.length > best.item.href.length) {
        best = { section, item };
      }
    }
  }
  return best;
}

export function AppSidebar({
  role,
  name,
  unreadNotifications = 0,
}: {
  role: Role;
  name: string;
  pathname?: string;
  unreadNotifications?: number;
}) {
  const pathname = usePathname() || "/dashboard";
  const sections = sectionsByRole[role];
  const trail = useMemo(() => findTrail(sections, pathname), [sections, pathname]);
  const [open, setOpen] = useState(false);

  const activeSectionId = trail?.section.id;

  return (
    <>
      <button
        type="button"
        className="sidebar-crumb-toggle"
        aria-expanded={open}
        aria-controls="app-sidebar-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sidebar-crumb-toggle__path" aria-label="Current location">
          <span>Ajira</span>
          {trail ? (
            <>
              <span className="sidebar-crumb-sep" aria-hidden>
                /
              </span>
              <span>{trail.section.label}</span>
              <span className="sidebar-crumb-sep" aria-hidden>
                /
              </span>
              <span className="sidebar-crumb-current">{trail.item.label}</span>
            </>
          ) : (
            <>
              <span className="sidebar-crumb-sep" aria-hidden>
                /
              </span>
              <span className="sidebar-crumb-current">Dashboard</span>
            </>
          )}
        </span>
        <span className="sidebar-crumb-toggle__hint">{open ? "Close" : "Menu"}</span>
      </button>

      {open ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id="app-sidebar-nav"
        className="sidebar"
        data-open={open ? "true" : "false"}
      >
        <div className="sidebar-brand">
          <Link href="/" className="font-display text-2xl text-cream" onClick={() => setOpen(false)}>
            Ajira
          </Link>
          <p className="mt-2 text-sm text-[rgba(247,243,236,0.65)]">{name}</p>
          <p className="text-xs uppercase tracking-[0.14em] text-forest-glow">{role}</p>
        </div>

        <nav className="sidebar-crumb-nav" aria-label="Dashboard">
          <ol className="sidebar-crumb-root">
            <li className="sidebar-crumb-root__item">
              <span className="sidebar-crumb-root__label">Ajira</span>
              <ol className="sidebar-crumb-sections">
                {sections.map((section) => {
                  const sectionActive = section.id === activeSectionId;
                  return (
                    <li
                      key={section.id}
                      className="sidebar-crumb-section"
                      data-active={sectionActive ? "true" : "false"}
                    >
                      <div className="sidebar-crumb-section__head">
                        <span className="sidebar-crumb-sep" aria-hidden>
                          /
                        </span>
                        <span className="sidebar-crumb-section__label">{section.label}</span>
                      </div>
                      <ol className="sidebar-crumb-items">
                        {section.items.map((item) => {
                          const active = isActive(pathname, item.href);
                          const label =
                            item.href === "/dashboard/notifications" && unreadNotifications > 0
                              ? `${item.label} (${unreadNotifications})`
                              : item.label;
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                data-active={active ? "true" : "false"}
                                className="sidebar-crumb-link"
                                onClick={() => setOpen(false)}
                              >
                                <span className="sidebar-crumb-sep" aria-hidden>
                                  /
                                </span>
                                <span>{label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ol>
                    </li>
                  );
                })}
              </ol>
            </li>
          </ol>
        </nav>

        <form action={logoutAction} className="mt-auto pt-8">
          <button type="submit" className="btn btn-ghost w-full">
            Log out
          </button>
        </form>
      </aside>
    </>
  );
}

/** Path trail shown above page content (desktop + mobile). */
export function DashboardBreadcrumbs({ role }: { role: Role }) {
  const pathname = usePathname() || "/dashboard";
  const sections = sectionsByRole[role];
  const trail = findTrail(sections, pathname);

  return (
    <nav className="dash-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link href={role === "BUYER" ? "/dashboard/buyer" : role === "SELLER" ? "/dashboard/seller" : "/dashboard/admin"}>
            Ajira
          </Link>
        </li>
        {trail ? (
          <>
            <li aria-hidden className="dash-breadcrumb__sep">
              /
            </li>
            <li>
              <span>{trail.section.label}</span>
            </li>
            <li aria-hidden className="dash-breadcrumb__sep">
              /
            </li>
            <li>
              <span aria-current="page">{trail.item.label}</span>
            </li>
          </>
        ) : (
          <>
            <li aria-hidden className="dash-breadcrumb__sep">
              /
            </li>
            <li>
              <span aria-current="page">Dashboard</span>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
