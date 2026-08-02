import { NextResponse } from "next/server";

/**
 * IAB ads.txt at site root. Set NEXT_PUBLIC_ADSENSE_PUB_ID=pub-xxxxxxxxxxxxxxxx
 * See https://support.google.com/adsense/answer/12171612
 */
export async function GET() {
  const pubId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID?.trim();
  const lines = [
    "# Ajira ads.txt — authorized digital sellers",
    "# Replace/confirm publisher ID after AdSense approval.",
  ];

  if (pubId && /^pub-\d{16}$/.test(pubId)) {
    lines.push(`google.com, ${pubId}, DIRECT, f08c47fec0942fa0`);
  } else {
    lines.push(
      "# google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0",
      "# Set NEXT_PUBLIC_ADSENSE_PUB_ID in environment to publish a live entry.",
    );
  }

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
