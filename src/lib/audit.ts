import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function logAdminAction(params: {
  adminId: string;
  action: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  let ipAddress: string | undefined;
  let userAgent: string | undefined;

  try {
    const h = await headers();
    ipAddress =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      undefined;
    userAgent = h.get("user-agent") || undefined;
  } catch {
    // headers() unavailable outside request context
  }

  return prisma.adminActivityLog.create({
    data: {
      adminId: params.adminId,
      action: params.action,
      summary: params.summary,
      targetType: params.targetType,
      targetId: params.targetId,
      oldValue: params.oldValue as object | undefined,
      newValue: params.newValue as object | undefined,
      ipAddress,
      userAgent,
    },
  });
}
