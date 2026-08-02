import { mobileCreateProject, mobileListProjects } from "@/lib/mobile/projects";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mobileListProjects(request);
}
export async function POST(request: Request) {
  return mobileCreateProject(request);
}
