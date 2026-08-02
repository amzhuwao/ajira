import {
  mobileListMilestones,
  mobileSetMilestones,
} from "@/lib/mobile/marketplace";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return mobileListMilestones(request, id);
}
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return mobileSetMilestones(request, id);
}
