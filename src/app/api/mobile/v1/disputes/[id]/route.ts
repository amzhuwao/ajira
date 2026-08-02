import { mobileGetDispute } from "@/lib/mobile/marketplace";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return mobileGetDispute(request, id);
}
