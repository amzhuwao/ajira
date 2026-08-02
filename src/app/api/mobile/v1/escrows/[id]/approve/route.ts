import { mobileApproveWork } from "@/lib/mobile/projects";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return mobileApproveWork(request, id);
}
