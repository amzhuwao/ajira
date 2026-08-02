import {
  mobileAdminGetSettings,
  mobileAdminUpdateSettings,
} from "@/lib/mobile/admin";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileAdminGetSettings(request);
}
export async function PUT(request: Request) {
  return mobileAdminUpdateSettings(request);
}
