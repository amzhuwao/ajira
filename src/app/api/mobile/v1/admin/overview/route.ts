import { mobileAdminOverview } from "@/lib/mobile/admin";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileAdminOverview(request);
}
