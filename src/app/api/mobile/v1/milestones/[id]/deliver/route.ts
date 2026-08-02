import { mobileMarkMilestoneDelivered } from "@/lib/mobile/marketplace";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return mobileMarkMilestoneDelivered(request, id);
}
