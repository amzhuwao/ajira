import { mobileListFavorites } from "@/lib/mobile/marketplace";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileListFavorites(request);
}
