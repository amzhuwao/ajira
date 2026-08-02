import { mobileListConversations } from "@/lib/mobile/account";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileListConversations(request);
}
