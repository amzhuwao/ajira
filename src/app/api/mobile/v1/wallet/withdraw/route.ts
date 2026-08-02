import { mobileRequestWithdrawal } from "@/lib/mobile/account";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return mobileRequestWithdrawal(request);
}
