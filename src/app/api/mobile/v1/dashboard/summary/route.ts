import { mobileDashboardSummary } from "@/lib/mobile/dashboard";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileDashboardSummary(request);
}
