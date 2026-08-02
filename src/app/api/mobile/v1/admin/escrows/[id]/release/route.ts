import { mobileAdminForceRelease } from "@/lib/mobile/admin";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return mobileAdminForceRelease(request, id);
}
