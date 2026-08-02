import { mobileListNotifications, mobileMarkNotificationsRead } from "@/lib/mobile/account";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileListNotifications(request);
}
export async function POST(request: Request) {
  return mobileMarkNotificationsRead(request);
}
