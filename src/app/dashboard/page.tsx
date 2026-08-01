import { redirect } from "next/navigation";
import { requireSession, dashboardPathForRole } from "@/lib/utils";

export default async function DashboardIndexPage() {
  const session = await requireSession();
  redirect(dashboardPathForRole(session.user.role));
}
