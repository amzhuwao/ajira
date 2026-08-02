import { mobileToggleFavorite } from "@/lib/mobile/marketplace";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ sellerId: string }> },
) {
  const { sellerId } = await ctx.params;
  return mobileToggleFavorite(request, sellerId);
}
