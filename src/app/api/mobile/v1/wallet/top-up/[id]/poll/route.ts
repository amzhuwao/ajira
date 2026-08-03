import { mobilePollTopUp } from "@/lib/mobile/account";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return mobilePollTopUp(request, id);
}
