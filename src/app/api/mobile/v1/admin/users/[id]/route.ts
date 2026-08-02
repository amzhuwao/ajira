import { mobileAdminGetUser, mobileAdminUpdateUser } from "@/lib/mobile/admin";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return mobileAdminGetUser(request, id);
}
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return mobileAdminUpdateUser(request, id);
}
