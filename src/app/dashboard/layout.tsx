import type { Metadata } from "next";
import { AppSidebar, DashboardBreadcrumbs } from "@/components/layout/sidebar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { requireSession } from "@/lib/utils";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const unread = await getUnreadNotificationCount(session.user.id);

  return (
    <div className="app-shell">
      <AppSidebar
        role={session.user.role}
        name={session.user.name}
        unreadNotifications={unread}
      />
      <div className="main-pane">
        <div className="main-pane__top">
          <DashboardBreadcrumbs role={session.user.role} />
          <NotificationBell count={unread} />
        </div>
        {children}
      </div>
    </div>
  );
}
