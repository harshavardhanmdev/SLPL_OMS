import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted in Docker — standalone bundles server + node_modules into .next/standalone
  output: "standalone",
};

export default nextConfig;
