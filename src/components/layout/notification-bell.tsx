import Link from "next/link";

export function NotificationBell({ count }: { count: number }) {
  return (
    <Link
      href="/dashboard/notifications"
      className="relative inline-flex h-10 items-center gap-2 rounded-full bg-sand px-4 text-sm font-medium text-ink"
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
    >
      Alerts
      {count > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-forest px-1 text-[11px] font-semibold text-cream">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
