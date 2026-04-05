import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Suppress hydration warnings for attributes added by browser extensions
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
