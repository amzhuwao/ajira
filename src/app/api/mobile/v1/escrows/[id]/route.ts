import { mobileGetEscrow } from "@/lib/mobile/projects";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return mobileGetEscrow(request, id);
}
