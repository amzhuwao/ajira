import { mobileAdminListEscrows } from "@/lib/mobile/admin";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileAdminListEscrows(request);
}
