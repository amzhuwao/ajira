import { mobileSubmitReview } from "@/lib/mobile/marketplace";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return mobileSubmitReview(request);
}
