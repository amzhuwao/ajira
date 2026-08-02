import { mobileMe } from "@/lib/mobile/auth-handlers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return mobileMe(request);
}
