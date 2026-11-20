import type { NextConfig } from "next";

import { legacyRedirects } from "./lib/site/legacy-redirects";

const dev = process.env.NODE_ENV !== "production";

// Every host the page may talk to. Prices come straight from the exchanges;
// nothing else is reached, so a script that slipped in has nowhere to send data.
const CONNECT = [
  "'self'",
  // Coinbase joins once it consents (lib/market/sources.ts).
  "https://api.kraken.com",
  // Saving the reader's workspace to their StratDeck account (lib/account).
  "https://www.stratdeck.uk",
  "wss://ws.kraken.com",
];

const CSP = [
  "default-src 'self'",
  // Next hydrates with inline scripts; dev mode also evaluates code.
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${CONNECT.join(" ")}${dev ? " ws://localhost:* http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const config: NextConfig = {
  // The shared look and UI primitives ship as TypeScript source.
  transpilePackages: ["@big-shared/ui"],
  poweredByHeader: false,
  redirects: async () => [
    ...legacyRedirects(),
    // Next's own trailing-slash redirect is off for PostHog's sake (below), so
    // every other page keeps one address: /ethereum/ goes to /ethereum.
    { source: "/:path((?!ingest/).+)/", destination: "/:path", permanent: true },
  ],
  // Usage counts reach PostHog's EU cloud through our own address
  // (lib/analytics), so the page's security policy names no other host.
  rewrites: async () => [
    { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
  ],
  // PostHog's paths end in a slash, which Next would otherwise redirect away.
  skipTrailingSlashRedirect: true,
  reactStrictMode: true,
  headers: async () => [
    {
      // Pyodide's files, fetched by the backtest sandbox, whose origin is its own.
      source: "/pyodide/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    },
    {
      // Every page but the sandbox, which sets a stricter policy of its own.
      source: "/:path((?!sandbox$|pyodide/).*)",
      headers: [
        { key: "Content-Security-Policy", value: CSP },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ],
    },
  ],
};

export default config;
