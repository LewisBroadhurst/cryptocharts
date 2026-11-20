const dev = process.env.NODE_ENV !== "production";

// Every host the page may talk to. Prices come straight from the exchanges;
// nothing else is reached, so a script that slipped in has nowhere to send data.
const CONNECT = [
  "'self'",
  // Coinbase joins once it consents (lib/market/sources.ts).
  "https://api.kraken.com",
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

/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
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
