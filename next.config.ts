import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["impit"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  outputFileTracingIncludes: {
    "/api/blends/[slug]/connect": [
      "./node_modules/header-generator/data_files/**",
      "./src/vendor/header-generator/data_files/**",
    ],
    "/api/blends/[slug]": [
      "./node_modules/header-generator/data_files/**",
      "./src/vendor/header-generator/data_files/**",
    ],
  },
};

export default nextConfig;
