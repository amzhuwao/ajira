import Script from "next/script";

/** Loads AdSense only when publisher id is configured. Ads require Google-certified CMP for EEA/UK/CH personalized ads. */
export function AdSenseLoader() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client || !client.startsWith("ca-pub-")) return null;

  return (
    <Script
      id="adsense-loader"
      async
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
    />
  );
}
