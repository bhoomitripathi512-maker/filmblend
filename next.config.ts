import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
