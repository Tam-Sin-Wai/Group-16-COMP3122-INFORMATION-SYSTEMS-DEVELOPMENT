import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Disable strict hydration checking for better extension compatibility
    isrMemoryCacheSize: 52 * 1024 * 1024,
  },
  // Suppress hydration warnings for attributes added by browser extensions
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
