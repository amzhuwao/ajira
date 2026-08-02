import { mobileGetWallet } from "@/lib/mobile/account";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileGetWallet(request);
}
