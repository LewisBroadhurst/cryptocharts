import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";
import UsageEvents from "@/components/site/UsageEvents";
import { SITE_NAME, SITE_URL } from "@/lib/site/seo";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Crypto Charts: live crypto charts",
  description:
    "Free live crypto charts with drawing tools and indicators for Bitcoin, Ethereum, Solana and more.",
  applicationName: SITE_NAME,
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh antialiased">
        {children}
        <Analytics />
        <UsageEvents />
      </body>
    </html>
  );
}
