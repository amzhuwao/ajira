import { mobileForgotPassword } from "@/lib/mobile/auth-handlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return mobileForgotPassword(request);
}
