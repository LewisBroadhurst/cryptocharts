import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cryptocharts.stratdeck.uk"),
  title: "Crypto Charts: free live crypto charts",
  description:
    "Free live crypto charts with drawing tools and indicators for Bitcoin, Ethereum, Solana and more.",
  applicationName: "Crypto Charts",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
