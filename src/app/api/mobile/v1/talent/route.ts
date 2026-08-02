import { mobileListTalent } from "@/lib/mobile/marketplace";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileListTalent(request);
}
