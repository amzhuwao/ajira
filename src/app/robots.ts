import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/legal";

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/how-it-works", "/services", "/privacy", "/terms", "/contact"],
        disallow: [
          "/dashboard",
          "/api",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/uploads",
        ],
      },
      {
        // Allow AdSense / Google advertising crawlers on public pages
        userAgent: "Mediapartners-Google",
        allow: "/",
        disallow: ["/dashboard", "/api", "/uploads"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
