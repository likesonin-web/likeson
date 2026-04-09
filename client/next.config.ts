import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   experimental: {
    optimizeCss: true, // Uses critters to inline critical CSS
  },
};

export default nextConfig;
