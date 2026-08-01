import { AppSidebar } from "@/components/layout/sidebar";
import { requireSession } from "@/lib/utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="app-shell">
      <AppSidebar
        role={session.user.role}
        name={session.user.name}
        pathname="/dashboard"
      />
      <div className="main-pane">{children}</div>
    </div>
  );
}
