import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/legal";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrl();
  const now = new Date();
  const paths = [
    "",
    "/about",
    "/how-it-works",
    "/services",
    "/privacy",
    "/terms",
    "/contact",
    "/download",
  ];

  return paths.map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/services" ? 0.8 : 0.6,
  }));
}
