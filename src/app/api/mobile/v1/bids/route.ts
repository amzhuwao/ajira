import { mobilePlaceBid } from "@/lib/mobile/projects";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return mobilePlaceBid(request);
}
