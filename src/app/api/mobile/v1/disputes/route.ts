import { mobileListDisputes, mobileOpenDispute } from "@/lib/mobile/marketplace";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileListDisputes(request);
}
export async function POST(request: Request) {
  return mobileOpenDispute(request);
}
