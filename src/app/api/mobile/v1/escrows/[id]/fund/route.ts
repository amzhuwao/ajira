import { mobileFundEscrow } from "@/lib/mobile/projects";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return mobileFundEscrow(request);
}
