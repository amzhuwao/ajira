import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { AdSenseLoader } from "@/components/ads/adsense-loader";
import { CookieNotice } from "@/components/layout/cookie-notice";
import { ServiceWorkerCleanup } from "@/components/service-worker-cleanup";
import { getAppUrl } from "@/lib/legal";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const appUrl = getAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Ajira — Freelance work, secured by escrow",
    template: "%s · Ajira",
  },
  description:
    "Ajira connects buyers and freelancers across Zimbabwe with Paynow-powered escrow, wallets, milestones, and clear dispute resolution.",
  applicationName: "Ajira",
  authors: [{ name: "Ajira", url: appUrl }],
  creator: "Ajira",
  keywords: [
    "Ajira",
    "Zimbabwe freelance",
    "Paynow escrow",
    "Ecocash freelancers",
    "hire freelancers Zimbabwe",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_ZW",
    url: appUrl,
    siteName: "Ajira",
    title: "Ajira — Freelance work, secured by escrow",
    description:
      "Hire and get paid with Paynow escrow. Projects, catalog services, milestones, and disputes — built for Zimbabwe.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ajira — Freelance work, secured by escrow",
    description:
      "Zimbabwe-ready freelance marketplace with Paynow escrow, wallets, and protected payouts.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export const viewport: Viewport = {
  themeColor: "#1a5c45",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Ajira",
        url: appUrl,
        email: "info@ajira.online",
        description:
          "Freelance marketplace with Paynow escrow for buyers and sellers in Zimbabwe.",
        contactPoint: {
          "@type": "ContactPoint",
          email: "info@ajira.online",
          contactType: "customer support",
        },
      },
      {
        "@type": "WebSite",
        name: "Ajira",
        url: appUrl,
        potentialAction: {
          "@type": "SearchAction",
          target: `${appUrl}/services`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${dmSans.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <CookieNotice />
        <AdSenseLoader />
        <ServiceWorkerCleanup />
      </body>
    </html>
  );
}
