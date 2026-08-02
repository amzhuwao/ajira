import { mobileGetMessages, mobileSendMessage } from "@/lib/mobile/account";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  return mobileGetMessages(request, projectId);
}
export async function POST(
  request: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  return mobileSendMessage(request, projectId);
}
